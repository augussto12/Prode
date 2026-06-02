import prisma from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { cachedApiCall } from '../services/cache.service.js';
import * as footballApi from '../services/football-api.service.js';

/**
 * Fetch fixture data from Explorer API (cached).
 * Returns null if not found.
 */
async function getFixtureFromApi(fixtureId) {
  const cacheKey = `fixture:${fixtureId}`;
  const data = await cachedApiCall(cacheKey, 300, async () => {
    const result = await footballApi.fetchFixtureById(fixtureId);
    return result.response?.[0] || null;
  });
  return data;
}

export async function upsertPrediction(userId, externalFixtureId, competitionId, data) {
  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const statusShort = fixture.fixture?.status?.short;
  const isStarted = !['NS', 'TBD', 'PST'].includes(statusShort);

  if (isStarted) {
    throw new BadRequestError('No se puede predecir despues de que el partido empezo');
  }

  const now = new Date();
  const matchDate = new Date(fixture.fixture.date);
  const lockoutTime = new Date(matchDate);
  lockoutTime.setMinutes(lockoutTime.getMinutes() - 5);

  if (now >= lockoutTime) {
    throw new BadRequestError('Las predicciones se cierran 5 minutos antes del partido');
  }

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  if (data.isJoker) {
    const usedJokers = await prisma.prediction.count({
      where: {
        userId,
        competitionId,
        isJoker: true,
        NOT: { externalFixtureId },
      },
    });

    if (usedJokers >= 3) {
      throw new BadRequestError('Ya usaste los 3 comodines x2 de esta competencia');
    }
  }

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
  const hasStarted = !['NS', 'TBD', 'PST'].includes(statusShort);

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
  const hasStarted = !['NS', 'TBD', 'PST'].includes(statusShort);

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
