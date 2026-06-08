import prisma from '../config/database.js';
import * as footballApi from '../services/football-api.service.js';
import { cachedApiCall } from '../services/cache.service.js';

function getMatchResult(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'HOME';
  if (homeGoals < awayGoals) return 'AWAY';
  return 'DRAW';
}

const legacyHitFields = {
  moreShotsHit: null,
  moreCornersHit: null,
  morePossessionHit: null,
  moreFoulsHit: null,
  moreCardsHit: null,
  moreOffsidesHit: null,
  moreSavesHit: null,
};

export function calculatePredictionPoints(prediction, fixtureData, config) {
  const actualHomeGoals = fixtureData.goals.home;
  const actualAwayGoals = fixtureData.goals.away;

  if (actualHomeGoals === null || actualAwayGoals === null) {
    return { points: 0, basePoints: 0, ...legacyHitFields };
  }

  if (prediction.homeGoals === null || prediction.awayGoals === null) {
    return { points: 0, basePoints: 0, ...legacyHitFields };
  }

  const actualResult = getMatchResult(actualHomeGoals, actualAwayGoals);
  const predictedResult = getMatchResult(prediction.homeGoals, prediction.awayGoals);
  const isExact =
    prediction.homeGoals === actualHomeGoals &&
    prediction.awayGoals === actualAwayGoals;

  const basePoints = isExact
    ? config.exactScore
    : predictedResult === actualResult
      ? config.correctWinner
      : 0;
  const points = prediction.isJoker ? basePoints * 2 : basePoints;

  return { points, basePoints, ...legacyHitFields };
}

/**
 * Fetch fixture data from Explorer API (cached).
 */
async function getFixtureFromApi(fixtureId) {
  const cacheKey = `fixture:${fixtureId}`;
  const data = await cachedApiCall(cacheKey, 300, async () => {
    const result = await footballApi.fetchFixtureById(fixtureId);
    return result.response?.[0] || null;
  });
  return data;
}

/**
 * Main batch scoring function.
 * 1. Finds all pending predictions
 * 2. Fetches fixture result from API
 * 3. Scores if finished
 * 4. Recalculates leaderboards
 */
export async function scorePendingPredictions() {
  const config = await prisma.scoringConfig.findFirst({ where: { id: 1 } });
  if (!config) throw new Error('No scoring config found');

  const pendingFixtures = await prisma.prediction.findMany({
    where: { isCalculated: false },
    select: { externalFixtureId: true },
    distinct: ['externalFixtureId'],
  });

  if (pendingFixtures.length === 0) {
    return { message: 'No hay predicciones pendientes para calcular.', calculated: 0 };
  }

  console.log(`[Scoring] ${pendingFixtures.length} fixtures pendientes`);

  let totalCalculated = 0;
  const finishedFixtures = [];

  for (const { externalFixtureId } of pendingFixtures) {
    const fixtureData = await getFixtureFromApi(externalFixtureId);
    if (!fixtureData) continue;

    const statusShort = fixtureData.fixture?.status?.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);
    if (!isFinished) continue;

    console.log(`[Scoring] ${fixtureData.teams?.home?.name} ${fixtureData.goals?.home}-${fixtureData.goals?.away} ${fixtureData.teams?.away?.name}`);

    const fixturePredictions = await prisma.prediction.findMany({
      where: { externalFixtureId, isCalculated: false },
    });

    for (const prediction of fixturePredictions) {
      const result = calculatePredictionPoints(prediction, fixtureData, config);

      await prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          pointsEarned: result.points,
          basePoints: result.basePoints,
          ...legacyHitFields,
          isCalculated: true,
        },
      });
      totalCalculated++;
    }

    finishedFixtures.push(externalFixtureId);
  }

  if (totalCalculated > 0) {
    await recalculateAllLeaderboards();
  }

  return {
    message: `Puntajes calculados para ${finishedFixtures.length} partidos.`,
    fixturesProcessed: finishedFixtures.length,
    predictionsCalculated: totalCalculated,
  };
}

/**
 * Recalcula los leaderboards de todos los grupos con una sola regla:
 * suma los puntos calculados de las predicciones de la misma competencia.
 */
export async function recalculateAllLeaderboards() {
  await prisma.$executeRawUnsafe(`
    UPDATE "GroupUser" gu
    SET "totalPoints" =
      COALESCE((
        SELECT SUM(p."pointsEarned")
        FROM "Prediction" p
        JOIN "Group" g ON g.id = gu."groupId"
        WHERE p."userId" = gu."userId"
          AND p."isCalculated" = true
          AND p."competitionId" = g."competitionId"
      ), 0)
      +
      COALESCE((
        SELECT SUM(o."pointsEarned")
        FROM "OutrightPrediction" o
        JOIN "Group" g ON g.id = gu."groupId"
        WHERE o."userId" = gu."userId"
          AND o."isCalculated" = true
          AND o."competitionId" = g."competitionId"
      ), 0)
  `);
}

/**
 * Re-verifica resultados de predicciones calculadas en las ultimas 24hs.
 * Si la API indica que un partido no esta terminado pero ya lo calculamos,
 * resetea esas predicciones para que se recalculen en el proximo ciclo.
 */
export async function reverifyRecentResults() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentFixtures = await prisma.prediction.findMany({
    where: {
      isCalculated: true,
      updatedAt: { gte: cutoff },
    },
    select: { externalFixtureId: true },
    distinct: ['externalFixtureId'],
  });

  let checked = 0;
  let reset = 0;

  for (const { externalFixtureId } of recentFixtures) {
    checked++;
    try {
      const result = await footballApi.fetchFixtureById(externalFixtureId);
      const fixtureData = result.response?.[0];
      if (!fixtureData) continue;

      const statusShort = fixtureData.fixture?.status?.short;
      const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

      if (!isFinished) {
        const resetResult = await prisma.prediction.updateMany({
          where: { externalFixtureId, isCalculated: true },
          data: {
            isCalculated: false,
            pointsEarned: 0,
            basePoints: 0,
            ...legacyHitFields,
          },
        });
        reset++;
        console.log(`[Reverify] Fixture ${externalFixtureId} reseteado; status actual: ${statusShort}, ${resetResult.count} predicciones afectadas`);
      }
    } catch (err) {
      console.warn(`[Reverify] Error verificando fixture ${externalFixtureId}: ${err.message}`);
    }
  }

  if (reset > 0) {
    await recalculateAllLeaderboards();
  }

  return { checked, reset };
}

export async function getScoringConfig() {
  return prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function updateScoringConfig(data) {
  return prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}
