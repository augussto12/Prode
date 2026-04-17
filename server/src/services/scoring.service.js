import prisma from '../config/database.js';
import * as footballApi from '../services/football-api.service.js';
import { cachedApiCall } from '../services/cache.service.js';

function getMatchResult(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'HOME';
  if (homeGoals < awayGoals) return 'AWAY';
  return 'DRAW';
}

export function calculatePredictionPoints(prediction, fixtureData, config) {
  let points = 0;

  const actualHomeGoals = fixtureData.goals.home;
  const actualAwayGoals = fixtureData.goals.away;

  // If match doesn't have homeGoals/awayGoals recorded, we return 0.
  if (actualHomeGoals === null || actualAwayGoals === null) return 0;

  // Only calculate result points if prediction actually put goals.
  if (prediction.homeGoals !== null && prediction.awayGoals !== null) {
    const actualResult = getMatchResult(actualHomeGoals, actualAwayGoals);
    const predictedResult = prediction.homeGoals > prediction.awayGoals ? 'HOME' : prediction.homeGoals < prediction.awayGoals ? 'AWAY' : 'DRAW';

    const isExact = prediction.homeGoals === actualHomeGoals && prediction.awayGoals === actualAwayGoals;
    
    // 1. Result Sovereignty: You either get exact, or trend (winner). MUTUALLY EXCLUSIVE.
    if (isExact) {
      points += config.exactScore;
    } else if (predictedResult === actualResult) {
      points += config.correctWinner;
    }
  }

  // Stats handling (if applicable API returns stats)
  // To keep it simple, if no stats are provided, we don't score them.
  // In API-Football v3, stats are in a different endpoint. 
  // If we don't have them in fixtureData, we skip prop markets for now.
  const homeShots = fixtureData.homeShots ?? null;
  const awayShots = fixtureData.awayShots ?? null;
  const homeCorners = fixtureData.homeCorners ?? null;
  const awayCorners = fixtureData.awayCorners ?? null;

  // 2. Prop: More Shots (If API delivered the stat)
  if (prediction.moreShots && homeShots !== null && awayShots !== null) {
    const actual =
      homeShots > awayShots ? 'HOME' :
      homeShots < awayShots ? 'AWAY' : 'EQUAL';
    if (prediction.moreShots === actual) {
      points += config.moreShots;
    }
  }

  // 3. Prop: More Corners (If API delivered the stat)
  if (prediction.moreCorners && homeCorners !== null && awayCorners !== null) {
    const actual =
      homeCorners > awayCorners ? 'HOME' :
      homeCorners < awayCorners ? 'AWAY' : 'EQUAL';
    if (prediction.moreCorners === actual) {
      points += config.moreCorners;
    }
  }

  // Joker Multiplier (x2)
  if (prediction.isJoker) {
    points *= 2;
  }

  return points;
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
 * 2. Fetches fixture from API
 * 3. Scores if finished
 * 4. Recalculates leaderboards
 */
export async function scorePendingPredictions() {
  // Get global scoring config
  const config = await prisma.scoringConfig.findFirst({ where: { id: 1 } });
  if (!config) throw new Error('No scoring config found');

  // 1. Get unique pending fixture IDs
  const pendingFixtures = await prisma.prediction.findMany({
    where: { isCalculated: false },
    select: { externalFixtureId: true },
    distinct: ['externalFixtureId'],
  });

  if (pendingFixtures.length === 0) {
    return { message: 'No hay predicciones pendientes para calcular.', calculated: 0 };
  }

  let totalCalculated = 0;
  const finishedFixtures = [];

  // 2. Group process by fixture to minimize API calls
  for (const { externalFixtureId } of pendingFixtures) {
    const fixtureData = await getFixtureFromApi(externalFixtureId);
    if (!fixtureData) continue;

    const statusShort = fixtureData.fixture?.status?.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

    if (isFinished) {
      // 3. Fetch stats if we need to score shots/corners
      // Ideally we would only fetch this if the config awards > 0 points to avoid unnecessary API calls
      if (config.moreShots > 0 || config.moreCorners > 0) {
        const statsData = await cachedApiCall(`fixture-stats:${externalFixtureId}`, 86400, async () => {
          const result = await footballApi.fetchFixtureStats(externalFixtureId);
          return result.response || [];
        });

        // Parse stats
        const homeStats = statsData.find(s => s.team.id === fixtureData.teams.home.id)?.statistics || [];
        const awayStats = statsData.find(s => s.team.id === fixtureData.teams.away.id)?.statistics || [];
        
        const getStat = (arr, type) => {
          const s = arr.find(x => x.type === type);
          return s && s.value !== null ? Number(s.value) : null;
        };

        fixtureData.homeShots = getStat(homeStats, 'Total Shots');
        fixtureData.awayShots = getStat(awayStats, 'Total Shots');
        fixtureData.homeCorners = getStat(homeStats, 'Corner Kicks');
        fixtureData.awayCorners = getStat(awayStats, 'Corner Kicks');
      }

      // Fetch all predictions for this fixture
      const fixturePredictions = await prisma.prediction.findMany({
        where: { externalFixtureId, isCalculated: false }
      });

      // Calculate and update
      for (const prediction of fixturePredictions) {
        const points = calculatePredictionPoints(prediction, fixtureData, config);
        await prisma.prediction.update({
          where: { id: prediction.id },
          data: { pointsEarned: points, isCalculated: true },
        });
        totalCalculated++;
      }
      finishedFixtures.push(externalFixtureId);
    }
  }

  // 4. Update leaderboards for ALL groups atomically (now joining Prediction mapped to Group.competitionId)
  if (totalCalculated > 0) {
    await recalculateAllLeaderboards();
  }

  return { 
    message: `Puntajes calculados para ${finishedFixtures.length} partidos.`, 
    fixturesProcessed: finishedFixtures.length,
    predictionsCalculated: totalCalculated 
  };
}

/**
 * Recalcula los leaderboards de TODOS los grupos en UNA sola query SQL.
 * Reemplaza el loop N+1 anterior con una operación atómica.
 */
export async function recalculateAllLeaderboards() {
  await prisma.$executeRawUnsafe(`
    UPDATE "GroupUser" gu
    SET "totalPoints" = COALESCE(sub.total, 0)
    FROM (
      SELECT gu2.id AS group_user_id, SUM(p."pointsEarned") AS total
      FROM "GroupUser" gu2
      JOIN "Group" g ON g.id = gu2."groupId"
      JOIN "Prediction" p ON p."userId" = gu2."userId" AND p."isCalculated" = true
      WHERE p."competitionId" = g."competitionId"
      GROUP BY gu2.id
    ) sub
    WHERE gu.id = sub.group_user_id
  `);

  // Poner en 0 a los que no tienen predicciones calculadas
  await prisma.$executeRawUnsafe(`
    UPDATE "GroupUser" gu
    SET "totalPoints" = 0
    WHERE gu.id NOT IN (
      SELECT gu2.id
      FROM "GroupUser" gu2
      JOIN "Group" g ON g.id = gu2."groupId"
      JOIN "Prediction" p ON p."userId" = gu2."userId" AND p."isCalculated" = true
      WHERE p."competitionId" = g."competitionId"
    )
  `);
}

export async function getScoringConfig() {
  return prisma.scoringConfig.findFirst({ where: { id: 1 } });
}

export async function updateScoringConfig(data) {
  return prisma.scoringConfig.update({
    where: { id: 1 },
    data,
  });
}
