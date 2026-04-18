import prisma from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
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
  // Verify fixture exists and hasn't started via API
  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const statusShort = fixture.fixture?.status?.short;
  const isStarted = !['NS', 'TBD', 'PST'].includes(statusShort);

  if (isStarted) {
    throw new BadRequestError('No se puede predecir después de que el partido empezó');
  }

  // Bloqueo 5 minutos antes del partido
  const now = new Date();
  const matchDate = new Date(fixture.fixture.date);
  const lockoutTime = new Date(matchDate);
  lockoutTime.setMinutes(lockoutTime.getMinutes() - 5);

  if (now >= lockoutTime) {
    throw new BadRequestError('Las predicciones se cierran 5 minutos antes del partido');
  }

  // Verify competition exists in our DB
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw new NotFoundError('Competición no encontrada');

  // Transaction for Joker atomicity
  return prisma.$transaction(async (tx) => {
    if (data.isJoker) {
      // Joker check: 1 per day — need to find other predictions on the same day
      const matchDateStart = new Date(matchDate);
      matchDateStart.setHours(0, 0, 0, 0);
      const matchDateEnd = new Date(matchDate);
      matchDateEnd.setHours(23, 59, 59, 999);

      // Get all user's predictions for this competition, find ones with joker on same day
      const existingJokerPredictions = await tx.prediction.findMany({
        where: {
          userId,
          isJoker: true,
          NOT: { externalFixtureId },
        },
      });

      // Check each joker prediction's fixture date via a quick API lookup
      // Optimization: we cache fixture data, so repeated lookups are nearly free
      for (const jp of existingJokerPredictions) {
        const jpFixture = await getFixtureFromApi(jp.externalFixtureId);
        if (jpFixture) {
          const jpDate = new Date(jpFixture.fixture.date);
          if (jpDate >= matchDateStart && jpDate <= matchDateEnd) {
            throw new BadRequestError('Ya usaste tu comodín x2 para esta fecha / día.');
          }
        }
      }
    }

    return tx.prediction.upsert({
      where: { userId_externalFixtureId: { userId, externalFixtureId } },
      update: {
        homeGoals: data.homeGoals,
        awayGoals: data.awayGoals,
        winner: data.winner,
        doubleChance: data.doubleChance,
        btts: data.btts,
        overUnder25: data.overUnder25,
        moreShots: data.moreShots,
        moreCorners: data.moreCorners,
        morePossession: data.morePossession,
        moreFouls: data.moreFouls,
        moreCards: data.moreCards,
        moreOffsides: data.moreOffsides,
        moreSaves: data.moreSaves,
        isJoker: data.isJoker ?? false,
      },
      create: {
        userId,
        externalFixtureId,
        competitionId,
        homeGoals: data.homeGoals,
        awayGoals: data.awayGoals,
        winner: data.winner,
        doubleChance: data.doubleChance,
        btts: data.btts,
        overUnder25: data.overUnder25,
        moreShots: data.moreShots,
        moreCorners: data.moreCorners,
        morePossession: data.morePossession,
        moreFouls: data.moreFouls,
        moreCards: data.moreCards,
        moreOffsides: data.moreOffsides,
        moreSaves: data.moreSaves,
        isJoker: data.isJoker ?? false,
      },
    });
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

export async function getPredictionsForFixture(externalFixtureId) {
  return prisma.prediction.findMany({
    where: { externalFixtureId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}

export async function getGroupPredictionsForFixture(externalFixtureId, groupId, requestingUserId) {
  // Verify fixture status via API
  const fixture = await getFixtureFromApi(externalFixtureId);
  const statusShort = fixture?.fixture?.status?.short;
  const hasStarted = !['NS', 'TBD', 'PST'].includes(statusShort);

  // Get members of this group
  const groupMembers = await prisma.groupUser.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const memberIds = groupMembers.map((m) => m.userId);

  // If match hasn't started, only return the requesting user's prediction
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
