import prisma from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { cachedApiCall } from '../services/cache.service.js';
import * as footballApi from '../services/football-api.service.js';
import { getFixturePredictionWindow } from './phase-window.service.js';
import { assertCanUseJoker } from './joker.service.js';

/**
 * Fetch fixture data from Explorer API (cached).
 * Returns null if not found.
 */
async function getFixtureFromApi(fixtureId) {
  const cacheKey = `api-football:fixture:raw:${fixtureId}`;
  const data = await cachedApiCall(cacheKey, 30, async () => {
    const result = await footballApi.fetchFixtureById(fixtureId);
    return result.response?.[0] || null;
  });
  return data;
}

export async function upsertPrediction(userId, externalFixtureId, competitionId, data) {
  if (data.homeGoals === null || data.homeGoals === undefined || data.awayGoals === null || data.awayGoals === undefined) {
    throw new BadRequestError('Tenes que cargar los goles de los dos equipos');
  }

  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  if (Number(fixture.league?.id) !== Number(competition.externalId)) {
    throw new BadRequestError('El partido no pertenece a esta competencia');
  }

  const statusShort = fixture.fixture?.status?.short;
  const isStarted = !['NS', 'TBD'].includes(statusShort);

  if (isStarted) {
    throw new BadRequestError('No se puede modificar la prediccion de un partido iniciado, interrumpido o postergado');
  }

  const predictionWindow = await getFixturePredictionWindow(competition, fixture);
  if (!predictionWindow.canPredict) {
    throw new BadRequestError(predictionWindow.reason || 'Las predicciones de esta fase estan cerradas');
  }

  if (!predictionWindow.phaseRule) {
    const now = new Date();
    const matchDate = new Date(fixture.fixture.date);
    const lockoutTime = new Date(matchDate);
    lockoutTime.setMinutes(lockoutTime.getMinutes() - 5);

    if (now >= lockoutTime) {
      throw new BadRequestError('Las predicciones se cierran 5 minutos antes del partido');
    }
  }

  const jokerAllowance = data.isJoker
    ? await assertCanUseJoker(userId, competitionId, externalFixtureId, fixture)
    : null;

  const resultOnlyData = {
    homeGoals: data.homeGoals,
    awayGoals: data.awayGoals,
    winner: null,
    doubleChance: null,
    btts: null,
    overUnder25: null,
    moreShots: null,
    moreCorners: null,
    morePossession: null,
    moreFouls: null,
    moreCards: null,
    moreOffsides: null,
    moreSaves: null,
    isJoker: data.isJoker ?? false,
    jokerPhaseKey: data.isJoker && jokerAllowance?.mode === 'phase_grant'
      ? jokerAllowance.phase.phaseKey
      : null,
    jokerGrantId: data.isJoker && jokerAllowance?.mode === 'phase_grant'
      ? jokerAllowance.grantId
      : null,
  };

  return prisma.prediction.upsert({
    where: { userId_externalFixtureId_source: { userId, externalFixtureId, source: 'api-football' } },
    update: resultOnlyData,
    create: {
      userId,
      externalFixtureId,
      competitionId,
      ...resultOnlyData,
    },
  });
}

export async function getMyPredictions(userId, competitionId = null) {
  const where = { userId };
  if (competitionId) {
    where.competitionId = Number(competitionId);
  }

  return prisma.prediction.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

export async function getPredictionsForFixture(externalFixtureId, requestingUserId) {
  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const statusShort = fixture?.fixture?.status?.short;
  const fixtureDate = fixture?.fixture?.date ? new Date(fixture.fixture.date) : null;
  const hasStarted =
    !['NS', 'TBD', 'PST'].includes(statusShort) ||
    (fixtureDate && Date.now() >= fixtureDate.getTime());

  if (!hasStarted) {
    return prisma.prediction.findMany({
      where: { externalFixtureId, userId: requestingUserId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    });
  }

  return prisma.prediction.findMany({
    where: { externalFixtureId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}

export async function getGroupPredictionsForFixture(externalFixtureId, groupId, requestingUserId) {
  const membership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: requestingUserId, groupId } },
  });

  if (!membership || membership.isBanned) {
    throw new ForbiddenError('No sos miembro activo de este grupo');
  }

  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const statusShort = fixture?.fixture?.status?.short;
  const fixtureDate = fixture?.fixture?.date ? new Date(fixture.fixture.date) : null;
  const hasStarted =
    !['NS', 'TBD', 'PST'].includes(statusShort) ||
    (fixtureDate && Date.now() >= fixtureDate.getTime());

  const groupMembers = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    select: { userId: true },
  });
  const memberIds = groupMembers.map((m) => m.userId);

  if (!hasStarted) {
    return prisma.prediction.findMany({
      where: { externalFixtureId, userId: requestingUserId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    });
  }

  return prisma.prediction.findMany({
    where: { externalFixtureId, userId: { in: memberIds } },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}
