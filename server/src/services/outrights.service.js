import prisma from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { recalculateAllLeaderboards } from './scoring.service.js';
import * as footballApi from './football-api.service.js';
import { syncSquad } from './sync.service.js';
import { cachedApiCall, invalidateCache } from './cache.service.js';
import { isFinalMatchFinished } from './phase-window.service.js';

const WORLD_CUP_2026_START = new Date('2026-06-11T19:00:00.000Z');

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
  const competition = await getCompetition(compId);

  const teamsFromApi = await syncAndListCompetitionTeams(competition);
  if (teamsFromApi.length > 0) return teamsFromApi;

  const fixtures = await prisma.fixture.findMany({
    where: {
      leagueId: competition.externalId,
      OR: [
        { seasonId: competition.season },
        { seasonId: null },
      ],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });

  const fixtureTeamIds = [
    ...new Set(fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]).filter(Boolean)),
  ];

  if (fixtureTeamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: fixtureTeamIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, logo: true, flag: true, country: true },
    });
    return formatTeamOptions(teams);
  }

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

  if (teamsFromStats.length > 0) return formatTeamOptions(teamsFromStats);

  return [];
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
    const team = await prisma.team.findUnique({
      where: { id: Number(teamId) },
      select: { externalId: true, source: true },
    });
    if (team?.source === 'api-football' && team.externalId) {
      await syncSquad(team.externalId, Number(competitionId)).catch((err) => {
        console.warn(`[Outrights] No se pudo sincronizar plantel ${team.externalId}: ${err.message}`);
      });
    }

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

async function syncAndListCompetitionTeams(competition) {
  try {
    const apiTeams = await cachedApiCall(
      `outrights:teams:${competition.externalId}:${competition.season}`,
      24 * 60 * 60,
      async () => {
        const result = await footballApi.fetchTeams(competition.externalId, competition.season);
        return (result.response || []).map((item) => item.team).filter((team) => team?.id && team?.name);
      },
    );

    const teams = (apiTeams || []).filter((team) => team?.id && team?.name);

    const teamIds = [];
    for (const team of teams) {
      const data = {
        externalId: Number(team.id),
        source: 'api-football',
        name: team.name,
        code: team.code || null,
        logo: team.logo || null,
        country: team.country || team.name,
        flag: team.national && team.code
          ? `https://media.api-sports.io/flags/${team.code.toLowerCase()}.svg`
          : null,
      };

      const saved = await prisma.team.upsert({
        where: { externalId_source: { externalId: data.externalId, source: data.source } },
        update: data,
        create: data,
        select: { id: true },
      });
      teamIds.push(saved.id);
    }

    if (teamIds.length === 0) return [];

    const savedTeams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, logo: true, flag: true, country: true },
    });
    return formatTeamOptions(savedTeams);
  } catch (err) {
    console.warn(`[Outrights] No se pudieron cargar equipos desde API-Football: ${err.message}`);
    return [];
  }
}

export async function syncCompetitionTeamsAndPlayers(competitionId, options = {}) {
  const competition = await getCompetition(Number(competitionId));
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Math.min(12, Math.max(1, Number(options.limit) || 6));
  invalidateCache(`outrights:teams:${competition.externalId}:${competition.season}`);

  const result = await footballApi.fetchTeams(competition.externalId, competition.season);
  const apiTeams = (result.response || [])
    .map((item) => item.team)
    .filter((team) => team?.id && team?.name);

  const teams = [];
  let teamsCreated = 0;
  let teamsUpdated = 0;

  for (const team of apiTeams) {
    const data = {
      externalId: Number(team.id),
      source: 'api-football',
      name: team.name,
      code: team.code || null,
      logo: team.logo || null,
      country: team.country || team.name,
      flag: team.national && team.code
        ? `https://media.api-sports.io/flags/${team.code.toLowerCase()}.svg`
        : null,
    };

    const existing = await prisma.team.findUnique({
      where: { externalId_source: { externalId: data.externalId, source: data.source } },
      select: { id: true },
    });

    const saved = existing
      ? await prisma.team.update({
          where: { externalId_source: { externalId: data.externalId, source: data.source } },
          data,
          select: { id: true, externalId: true, name: true },
        })
      : await prisma.team.create({
          data,
          select: { id: true, externalId: true, name: true },
        });

    if (existing) teamsUpdated++;
    else teamsCreated++;
    teams.push(saved);
  }

  const batch = teams.slice(offset, offset + limit);
  let playersCreated = 0;
  let playersUpdated = 0;
  let playersTotal = 0;
  const errors = [];

  for (const team of batch) {
    try {
      const squadResult = await syncSquad(team.externalId, competition.id);
      playersCreated += squadResult.created || 0;
      playersUpdated += squadResult.updated || 0;
      playersTotal += squadResult.total || 0;
      await delay(250);
    } catch (err) {
      errors.push({ team: team.name, error: err.message });
    }
  }

  const nextOffset = offset + batch.length;
  const done = nextOffset >= teams.length;

  return {
    message: done
      ? `Selecciones y jugadores sincronizados para ${competition.name}.`
      : `Sincronizadas ${nextOffset}/${teams.length} selecciones de ${competition.name}.`,
    competitionId: competition.id,
    competitionName: competition.name,
    offset,
    limit,
    processed: batch.length,
    nextOffset,
    done,
    teams: {
      total: teams.length,
      created: teamsCreated,
      updated: teamsUpdated,
    },
    players: {
      total: playersTotal,
      created: playersCreated,
      updated: playersUpdated,
    },
    errors,
  };
}

async function validateTeamId(teamId, field, competitionId = null) {
  if (!teamId) return null;
  const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
  if (!team) throw new BadRequestError(`${field} no existe`);
  if (competitionId) {
    const allowedTeams = await listTeams(Number(competitionId));
    const allowed = allowedTeams.some((option) => option.id === team.id);
    if (!allowed) throw new BadRequestError(`${field} no pertenece a esta competencia`);
  }
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

  const championTeamId = await validateTeamId(data.championTeamId, 'Campeon', competitionId);
  const runnerUpTeamId = await validateTeamId(data.runnerUpTeamId, 'Subcampeon', competitionId);
  if (championTeamId && runnerUpTeamId && championTeamId === runnerUpTeamId) {
    throw new BadRequestError('Campeon y subcampeon no pueden ser el mismo equipo');
  }

  const topScorerTeamId = await validateTeamId(data.topScorerTeamId, 'Seleccion del goleador', competitionId);
  const goldenGloveTeamId = await validateTeamId(data.goldenGloveTeamId, 'Seleccion del guante de oro', competitionId);
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

  const championTeamId = await validateTeamId(data.championTeamId, 'Campeon oficial', competitionId);
  const runnerUpTeamId = await validateTeamId(data.runnerUpTeamId, 'Subcampeon oficial', competitionId);
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

export async function calculateReadyOutrightScores() {
  const results = await prisma.outrightResult.findMany({
    where: {
      calculatedAt: null,
      championTeamId: { not: null },
      runnerUpTeamId: { not: null },
      topScorerId: { not: null },
      goldenGloveId: { not: null },
    },
    select: { competitionId: true },
  });

  let checked = 0;
  let calculated = 0;
  const errors = [];

  for (const result of results) {
    checked++;
    try {
      const finalFinished = await isFinalMatchFinished(result.competitionId);
      if (!finalFinished) continue;

      await calculateOutrightScores(result.competitionId);
      calculated++;
    } catch (err) {
      errors.push({ competitionId: result.competitionId, error: err.message });
    }
  }

  return { checked, calculated, errors };
}

function normalizedName(value) {
  return String(value || '').trim().toLowerCase();
}

const NATIONAL_TEAM_NAMES_ES = {
  Algeria: 'Argelia',
  Argentina: 'Argentina',
  Australia: 'Australia',
  Austria: 'Austria',
  Belgium: 'Bélgica',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  Brazil: 'Brasil',
  Canada: 'Canada',
  'Cape Verde Islands': 'Cabo Verde',
  Colombia: 'Colombia',
  'Congo DR': 'RD Congo',
  Croatia: 'Croacia',
  Curacao: 'Curazao',
  Curaçao: 'Curazao',
  'Czech Republic': 'Republica Checa',
  Ecuador: 'Ecuador',
  Egypt: 'Egipto',
  England: 'Inglaterra',
  France: 'Francia',
  Germany: 'Alemania',
  Ghana: 'Ghana',
  Haiti: 'Haití',
  Iran: 'Irán',
  Iraq: 'Irak',
  'Ivory Coast': 'Costa de Marfil',
  Japan: 'Japón',
  Jordan: 'Jordania',
  Mexico: 'México',
  Morocco: 'Marruecos',
  Netherlands: 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  Norway: 'Noruega',
  Panama: 'Panamá',
  Paraguay: 'Paraguay',
  Portugal: 'Portugal',
  Qatar: 'Catar',
  'Saudi Arabia': 'Arabia Saudita',
  Scotland: 'Escocia',
  Senegal: 'Senegal',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  Spain: 'España',
  Sweden: 'Suecia',
  Switzerland: 'Suiza',
  Tunisia: 'Túnez',
  Türkiye: 'Turquía',
  USA: 'Estados Unidos',
  Uruguay: 'Uruguay',
  Uzbekistan: 'Uzbekistán',
};

function translateTeamName(name) {
  return NATIONAL_TEAM_NAMES_ES[name] || name;
}

function formatTeamOptions(teams) {
  return teams.map((team) => ({
    ...team,
    displayName: translateTeamName(team.name),
  }));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
