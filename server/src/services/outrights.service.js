import prisma from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { recalculateAllLeaderboards } from './scoring.service.js';

const WORLD_CUP_2026_START = new Date('2026-06-11T00:00:00.000Z');

const predictionInclude = {
  championTeamRef: { select: { id: true, name: true, logo: true, flag: true } },
  runnerUpTeamRef: { select: { id: true, name: true, logo: true, flag: true } },
  topScorerTeam: { select: { id: true, name: true, logo: true, flag: true } },
  goldenGloveTeam: { select: { id: true, name: true, logo: true, flag: true } },
  topScorer: { select: { id: true, name: true, photo: true, image: true, position: true, country: true, teamId: true } },
  goldenGlove: { select: { id: true, name: true, photo: true, image: true, position: true, country: true, teamId: true } },
};

const resultInclude = {
  championTeam: { select: { id: true, name: true, logo: true, flag: true } },
  runnerUpTeam: { select: { id: true, name: true, logo: true, flag: true } },
  topScorer: { select: { id: true, name: true, photo: true, image: true, position: true, country: true, teamId: true } },
  goldenGlove: { select: { id: true, name: true, photo: true, image: true, position: true, country: true, teamId: true } },
};

async function getCompetition(competitionId) {
  const competition = await prisma.competition.findUnique({
    where: { id: Number(competitionId) },
  });
  if (!competition) throw new NotFoundError('Competencia no encontrada');
  return competition;
}

async function resolveDefaultLockAt(competition) {
  const firstFixture = await prisma.fixture.findFirst({
    where: {
      leagueId: competition.externalId,
      OR: [
        { seasonId: competition.season },
        { seasonId: null },
      ],
    },
    orderBy: { startTime: 'asc' },
    select: { startTime: true },
  });

  if (firstFixture?.startTime) return firstFixture.startTime;
  if (competition.externalId === 1 && competition.season === 2026) return WORLD_CUP_2026_START;
  return null;
}

export async function getLockInfo(competitionId) {
  const competition = await getCompetition(competitionId);
  const result = await prisma.outrightResult.findUnique({
    where: { competitionId: competition.id },
  });
  const lockAt = result?.lockAt || await resolveDefaultLockAt(competition);
  const locked = lockAt ? Date.now() >= new Date(lockAt).getTime() : false;

  return { competition, lockAt, locked };
}

export async function listTeams(competitionId) {
  const compId = Number(competitionId);
  const teamsFromStats = await prisma.team.findMany({
    where: {
      players: {
        some: {
          stats: {
            some: { competitionId: compId },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, logo: true, flag: true, country: true },
  });

  if (teamsFromStats.length > 0) return teamsFromStats;

  return prisma.team.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, logo: true, flag: true, country: true },
  });
}

export async function listPlayers({ competitionId, teamId, position }) {
  const where = {
    teamId: Number(teamId),
    ...(position ? { position } : {}),
    ...(competitionId ? {
      stats: { some: { competitionId: Number(competitionId) } },
    } : {}),
  };

  let players = await prisma.player.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      position: true,
      country: true,
      image: true,
      photo: true,
      teamId: true,
      team: { select: { id: true, name: true, logo: true, flag: true } },
    },
  });

  if (players.length === 0 && competitionId) {
    players = await prisma.player.findMany({
      where: {
        teamId: Number(teamId),
        ...(position ? { position } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        country: true,
        image: true,
        photo: true,
        teamId: true,
        team: { select: { id: true, name: true, logo: true, flag: true } },
      },
    });
  }

  return players;
}

async function validateTeamId(teamId, field) {
  if (!teamId) return null;
  const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
  if (!team) throw new BadRequestError(`${field} no existe`);
  return team.id;
}

async function validatePlayerForTeam(playerId, teamId, field, position = null) {
  if (!playerId) return null;
  if (!teamId) throw new BadRequestError(`Primero selecciona la seleccion para ${field}`);

  const player = await prisma.player.findUnique({
    where: { id: Number(playerId) },
    select: { id: true, teamId: true, position: true },
  });
  if (!player) throw new BadRequestError(`${field} no existe`);
  if (player.teamId !== Number(teamId)) {
    throw new BadRequestError(`${field} no pertenece a la seleccion elegida`);
  }
  if (position && player.position !== position) {
    throw new BadRequestError(`${field} debe ser arquero`);
  }
  return player.id;
}

export async function getMyOutrights(userId, competitionId) {
  const { lockAt, locked } = await getLockInfo(competitionId);
  const prediction = await prisma.outrightPrediction.findUnique({
    where: {
      userId_competitionId: {
        userId,
        competitionId: Number(competitionId),
      },
    },
    include: predictionInclude,
  });

  return { prediction, lockAt, locked };
}

export async function saveMyOutrights(userId, data) {
  const competitionId = Number(data.competitionId);
  const { locked } = await getLockInfo(competitionId);
  if (locked) throw new ForbiddenError('El Mundial ya empezo y estas predicciones no se pueden cambiar');

  const championTeamId = await validateTeamId(data.championTeamId, 'Campeon');
  const runnerUpTeamId = await validateTeamId(data.runnerUpTeamId, 'Subcampeon');
  if (championTeamId && runnerUpTeamId && championTeamId === runnerUpTeamId) {
    throw new BadRequestError('Campeon y subcampeon no pueden ser el mismo equipo');
  }

  const topScorerTeamId = await validateTeamId(data.topScorerTeamId, 'Seleccion del goleador');
  const goldenGloveTeamId = await validateTeamId(data.goldenGloveTeamId, 'Seleccion del guante de oro');
  const topScorerId = await validatePlayerForTeam(data.topScorerId, topScorerTeamId, 'Goleador');
  const goldenGloveId = await validatePlayerForTeam(data.goldenGloveId, goldenGloveTeamId, 'Guante de oro', 'GK');

  return prisma.outrightPrediction.upsert({
    where: { userId_competitionId: { userId, competitionId } },
    update: {
      championTeamId,
      runnerUpTeamId,
      topScorerTeamId,
      topScorerId,
      goldenGloveTeamId,
      goldenGloveId,
      championTeam: null,
      runnerUpTeam: null,
      bestPlayerId: null,
      pointsEarned: 0,
      isCalculated: false,
      championHit: null,
      runnerUpHit: null,
      topScorerHit: null,
      goldenGloveHit: null,
    },
    create: {
      userId,
      competitionId,
      championTeamId,
      runnerUpTeamId,
      topScorerTeamId,
      topScorerId,
      goldenGloveTeamId,
      goldenGloveId,
    },
    include: predictionInclude,
  });
}

export async function getAdminResult(competitionId) {
  const { lockAt, locked } = await getLockInfo(competitionId);
  const result = await prisma.outrightResult.findUnique({
    where: { competitionId: Number(competitionId) },
    include: resultInclude,
  });
  return { result, lockAt, locked };
}

export async function saveAdminResult(data) {
  const competitionId = Number(data.competitionId);
  await getCompetition(competitionId);

  const championTeamId = await validateTeamId(data.championTeamId, 'Campeon oficial');
  const runnerUpTeamId = await validateTeamId(data.runnerUpTeamId, 'Subcampeon oficial');
  if (championTeamId && runnerUpTeamId && championTeamId === runnerUpTeamId) {
    throw new BadRequestError('Campeon y subcampeon oficiales no pueden ser el mismo equipo');
  }

  const topScorerId = data.topScorerId ? Number(data.topScorerId) : null;
  const goldenGloveId = data.goldenGloveId ? Number(data.goldenGloveId) : null;
  if (topScorerId) await validatePlayerExists(topScorerId, 'Goleador oficial');
  if (goldenGloveId) await validatePlayerExists(goldenGloveId, 'Guante de oro oficial', 'GK');

  const lockAt = data.lockAt ? new Date(data.lockAt) : null;
  if (lockAt && Number.isNaN(lockAt.getTime())) {
    throw new BadRequestError('Fecha de bloqueo invalida');
  }

  return prisma.outrightResult.upsert({
    where: { competitionId },
    update: {
      lockAt,
      championTeamId,
      runnerUpTeamId,
      topScorerId,
      goldenGloveId,
    },
    create: {
      competitionId,
      lockAt,
      championTeamId,
      runnerUpTeamId,
      topScorerId,
      goldenGloveId,
    },
    include: resultInclude,
  });
}

async function validatePlayerExists(playerId, field, position = null) {
  const player = await prisma.player.findUnique({
    where: { id: Number(playerId) },
    select: { id: true, position: true },
  });
  if (!player) throw new BadRequestError(`${field} no existe`);
  if (position && player.position !== position) throw new BadRequestError(`${field} debe ser arquero`);
}

export async function calculateOutrightScores(competitionId) {
  const compId = Number(competitionId);
  const [result, config] = await Promise.all([
    prisma.outrightResult.findUnique({
      where: { competitionId: compId },
      include: {
        championTeam: { select: { name: true } },
        runnerUpTeam: { select: { name: true } },
      },
    }),
    prisma.scoringConfig.findFirst({ where: { id: 1 } }),
  ]);

  if (!result) throw new BadRequestError('Primero carga los ganadores oficiales');
  if (!config) throw new BadRequestError('No hay configuracion de scoring');

  const missing = [];
  if (!result.championTeamId) missing.push('campeon');
  if (!result.runnerUpTeamId) missing.push('subcampeon');
  if (!result.topScorerId) missing.push('goleador');
  if (!result.goldenGloveId) missing.push('guante de oro');
  if (missing.length > 0) {
    throw new BadRequestError(`Faltan ganadores oficiales: ${missing.join(', ')}`);
  }

  const predictions = await prisma.outrightPrediction.findMany({
    where: { competitionId: compId },
  });

  for (const prediction of predictions) {
    const championHit = prediction.championTeamId
      ? prediction.championTeamId === result.championTeamId
      : normalizedName(prediction.championTeam) === normalizedName(result.championTeam?.name);
    const runnerUpHit = prediction.runnerUpTeamId
      ? prediction.runnerUpTeamId === result.runnerUpTeamId
      : normalizedName(prediction.runnerUpTeam) === normalizedName(result.runnerUpTeam?.name);
    const topScorerHit = prediction.topScorerId === result.topScorerId;
    const goldenGloveHit = prediction.goldenGloveId === result.goldenGloveId;
    const pointsEarned =
      (championHit ? config.champion : 0) +
      (runnerUpHit ? config.runnerUp : 0) +
      (topScorerHit ? config.topScorer : 0) +
      (goldenGloveHit ? config.goldenGlove : 0);

    await prisma.outrightPrediction.update({
      where: { id: prediction.id },
      data: {
        championHit,
        runnerUpHit,
        topScorerHit,
        goldenGloveHit,
        pointsEarned,
        isCalculated: true,
      },
    });
  }

  await prisma.outrightResult.update({
    where: { competitionId: compId },
    data: { calculatedAt: new Date() },
  });
  await recalculateAllLeaderboards();

  return {
    message: `Premios finales calculados para ${predictions.length} predicciones.`,
    predictionsCalculated: predictions.length,
  };
}

function normalizedName(value) {
  return String(value || '').trim().toLowerCase();
}
