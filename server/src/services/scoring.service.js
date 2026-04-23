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
  let basePoints = 0;
  let moreShotsHit = null;
  let moreCornersHit = null;
  let morePossessionHit = null;
  let moreFoulsHit = null;
  let moreCardsHit = null;
  let moreOffsidesHit = null;
  let moreSavesHit = null;

  const actualHomeGoals = fixtureData.goals.home;
  const actualAwayGoals = fixtureData.goals.away;

  // If match doesn't have homeGoals/awayGoals recorded, we return 0.
  if (actualHomeGoals === null || actualAwayGoals === null) {
    return { 
      points: 0, 
      basePoints: 0,
      moreShotsHit: null, 
      moreCornersHit: null,
      morePossessionHit: null,
      moreFoulsHit: null,
      moreCardsHit: null,
      moreOffsidesHit: null,
      moreSavesHit: null
    };
  }

  // Only calculate result points if prediction actually put goals.
  if (prediction.homeGoals !== null && prediction.awayGoals !== null) {
    const actualResult = getMatchResult(actualHomeGoals, actualAwayGoals);
    const predictedResult = prediction.homeGoals > prediction.awayGoals ? 'HOME' : prediction.homeGoals < prediction.awayGoals ? 'AWAY' : 'DRAW';

    const isExact = prediction.homeGoals === actualHomeGoals && prediction.awayGoals === actualAwayGoals;
    
    // 1. Result Sovereignty: You either get exact, or trend (winner). MUTUALLY EXCLUSIVE.
    if (isExact) {
      points += config.exactScore;
      basePoints += config.exactScore;
    } else if (predictedResult === actualResult) {
      points += config.correctWinner;
      basePoints += config.correctWinner;
    }
  }

  // Stats handling
  const homeShots = fixtureData.homeShots ?? null;
  const awayShots = fixtureData.awayShots ?? null;
  const homeCorners = fixtureData.homeCorners ?? null;
  const awayCorners = fixtureData.awayCorners ?? null;
  const homePossession = fixtureData.homePossession ?? null;
  const awayPossession = fixtureData.awayPossession ?? null;
  const homeFouls = fixtureData.homeFouls ?? null;
  const awayFouls = fixtureData.awayFouls ?? null;
  const homeCards = fixtureData.homeCards ?? null;
  const awayCards = fixtureData.awayCards ?? null;
  const homeOffsides = fixtureData.homeOffsides ?? null;
  const awayOffsides = fixtureData.awayOffsides ?? null;
  const homeSaves = fixtureData.homeSaves ?? null;
  const awaySaves = fixtureData.awaySaves ?? null;

  // Generic stat checker
  const checkStat = (predictionValue, hVal, aVal, pointReward) => {
    if (!predictionValue || hVal === null || aVal === null) return null;
    const actual = hVal > aVal ? 'HOME' : hVal < aVal ? 'AWAY' : 'EQUAL';
    const hit = predictionValue === actual;
    if (hit) points += pointReward;
    return hit;
  };

  // Extras execution
  moreShotsHit = checkStat(prediction.moreShots, homeShots, awayShots, config.moreShots);
  moreCornersHit = checkStat(prediction.moreCorners, homeCorners, awayCorners, config.moreCorners);
  morePossessionHit = checkStat(prediction.morePossession, homePossession, awayPossession, config.morePossession);
  moreFoulsHit = checkStat(prediction.moreFouls, homeFouls, awayFouls, config.moreFouls);
  moreCardsHit = checkStat(prediction.moreCards, homeCards, awayCards, config.moreCards);
  moreOffsidesHit = checkStat(prediction.moreOffsides, homeOffsides, awayOffsides, config.moreOffsides);
  moreSavesHit = checkStat(prediction.moreSaves, homeSaves, awaySaves, config.moreSaves);
  // Joker Multiplier (x2) — se aplica al total (base + extras)
  if (prediction.isJoker) {
    points *= 2;
    // basePoints se guarda SIN multiplicar — el SQL del leaderboard aplica joker
  }

  return { 
    points, 
    basePoints,
    moreShotsHit, 
    moreCornersHit,
    morePossessionHit,
    moreFoulsHit,
    moreCardsHit,
    moreOffsidesHit,
    moreSavesHit
  };
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

  console.log(`[Scoring] ▶ ${pendingFixtures.length} fixtures pendientes`);

  let totalCalculated = 0;
  const finishedFixtures = [];

  // 2. Group process by fixture to minimize API calls
  for (const { externalFixtureId } of pendingFixtures) {
    const fixtureData = await getFixtureFromApi(externalFixtureId);
    if (!fixtureData) {
      // No data from API — skip silently
      continue;
    }

    const statusShort = fixtureData.fixture?.status?.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

    if (!isFinished) {
      // Not finished yet — skip silently
      continue;
    }

    console.log(`[Scoring] ✓ ${fixtureData.teams?.home?.name} ${fixtureData.goals?.home}-${fixtureData.goals?.away} ${fixtureData.teams?.away?.name}`);

    // 3. Fetch stats if we need to score shots/corners
    if (config.moreShots > 0 || config.moreCorners > 0 || config.morePossession > 0 || config.moreFouls > 0 || config.moreCards > 0 || config.moreOffsides > 0 || config.moreSaves > 0) {
      const statsData = await cachedApiCall(`fixture-stats:${externalFixtureId}`, 86400, async () => {
        const result = await footballApi.fetchFixtureStats(externalFixtureId);
        return result.response || [];
      });

      // Parse stats
      const homeStats = statsData.find(s => s.team.id === fixtureData.teams.home.id)?.statistics || [];
      const awayStats = statsData.find(s => s.team.id === fixtureData.teams.away.id)?.statistics || [];
      
      const getStat = (arr, type) => {
        const s = arr.find(x => x.type === type);
        if (!s || s.value === null) return null;
        const valStr = String(s.value).replace('%', '');
        return Number(valStr);
      };

      fixtureData.homeShots = getStat(homeStats, 'Shots on Goal');
      fixtureData.awayShots = getStat(awayStats, 'Shots on Goal');
      fixtureData.homeCorners = getStat(homeStats, 'Corner Kicks');
      fixtureData.awayCorners = getStat(awayStats, 'Corner Kicks');
      fixtureData.homePossession = getStat(homeStats, 'Ball Possession');
      fixtureData.awayPossession = getStat(awayStats, 'Ball Possession');
      fixtureData.homeFouls = getStat(homeStats, 'Fouls');
      fixtureData.awayFouls = getStat(awayStats, 'Fouls');
      
      const homeY = getStat(homeStats, 'Yellow Cards') || 0;
      const homeR = getStat(homeStats, 'Red Cards') || 0;
      fixtureData.homeCards = homeY + homeR;
      
      const awayY = getStat(awayStats, 'Yellow Cards') || 0;
      const awayR = getStat(awayStats, 'Red Cards') || 0;
      fixtureData.awayCards = awayY + awayR;

      fixtureData.homeOffsides = getStat(homeStats, 'Offsides');
      fixtureData.awayOffsides = getStat(awayStats, 'Offsides');
      fixtureData.homeSaves = getStat(homeStats, 'Goalkeeper Saves');
      fixtureData.awaySaves = getStat(awayStats, 'Goalkeeper Saves');
    }

    // Fetch all predictions for this fixture
    const fixturePredictions = await prisma.prediction.findMany({
      where: { externalFixtureId, isCalculated: false }
    });

    // Calculate and update
    for (const prediction of fixturePredictions) {
      const result = calculatePredictionPoints(prediction, fixtureData, config);
      
      // Per-prediction detail omitted — tracked via CronJobLog summary
      
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { 
          pointsEarned: result.points, 
          basePoints: result.basePoints,
          moreShotsHit: result.moreShotsHit,
          moreCornersHit: result.moreCornersHit,
          morePossessionHit: result.morePossessionHit,
          moreFoulsHit: result.moreFoulsHit,
          moreCardsHit: result.moreCardsHit,
          moreOffsidesHit: result.moreOffsidesHit,
          moreSavesHit: result.moreSavesHit,
          isCalculated: true 
        },
      });
      totalCalculated++;
    }
    finishedFixtures.push(externalFixtureId);
  }

  // 4. Update leaderboards for ALL groups atomically
  if (totalCalculated > 0) {
    // ── Audit: snapshot ANTES del recálculo ──
    const beforeSnapshot = await prisma.groupUser.findMany({
      where: { isBanned: false },
      select: { id: true, userId: true, groupId: true, totalPoints: true },
    });
    const beforeMap = new Map(beforeSnapshot.map(gu => [gu.id, gu.totalPoints]));

    await recalculateAllLeaderboards();

    // ── Audit: snapshot DESPUÉS del recálculo ──
    const afterSnapshot = await prisma.groupUser.findMany({
      where: { isBanned: false },
      select: { id: true, userId: true, groupId: true, totalPoints: true },
    });

    // Log cambios significativos
    for (const after of afterSnapshot) {
      const before = beforeMap.get(after.id) ?? 0;
      if (after.totalPoints !== before) {
        const diff = after.totalPoints - before;
        // Leaderboard change tracked silently (visible via admin panel)
      }
    }
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
      SELECT gu2.id AS group_user_id, SUM(
        (CASE WHEN p."isJoker" = true THEN 2 ELSE 1 END) * (
          p."basePoints" + 
          (CASE WHEN g."allowMoreShots" = true AND p."moreShotsHit" = true THEN sc."moreShots" ELSE 0 END) +
          (CASE WHEN g."allowMoreCorners" = true AND p."moreCornersHit" = true THEN sc."moreCorners" ELSE 0 END) +
          (CASE WHEN g."allowMorePossession" = true AND p."morePossessionHit" = true THEN sc."morePossession" ELSE 0 END) +
          (CASE WHEN g."allowMoreFouls" = true AND p."moreFoulsHit" = true THEN sc."moreFouls" ELSE 0 END) +
          (CASE WHEN g."allowMoreCards" = true AND p."moreCardsHit" = true THEN sc."moreCards" ELSE 0 END) +
          (CASE WHEN g."allowMoreOffsides" = true AND p."moreOffsidesHit" = true THEN sc."moreOffsides" ELSE 0 END) +
          (CASE WHEN g."allowMoreSaves" = true AND p."moreSavesHit" = true THEN sc."moreSaves" ELSE 0 END)
        )
      ) AS total
      FROM "GroupUser" gu2
      JOIN "Group" g ON g.id = gu2."groupId"
      JOIN "Prediction" p ON p."userId" = gu2."userId" AND p."isCalculated" = true
      CROSS JOIN "ScoringConfig" sc
      WHERE p."competitionId" = g."competitionId" AND sc.id = 1
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

/**
 * Re-verifica resultados de predicciones calculadas en las últimas 24hs.
 * Si la API indica que un partido NO está terminado pero ya lo habíamos calculado,
 * resetea esas predicciones para que se recalculen en el próximo ciclo.
 * 
 * Se ejecuta SOLO en el ciclo de las 01:00 AM para no gastar API calls.
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
      // Fetch sin cache para obtener el dato más reciente
      const result = await footballApi.fetchFixtureById(externalFixtureId);
      const fixtureData = result.response?.[0];
      if (!fixtureData) continue;

      const statusShort = fixtureData.fixture?.status?.short;
      const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

      if (!isFinished) {
        // El partido NO está terminado pero nosotros ya lo calculamos → resetear
        const resetResult = await prisma.prediction.updateMany({
          where: { externalFixtureId, isCalculated: true },
          data: {
            isCalculated: false,
            pointsEarned: 0,
            basePoints: 0,
            moreShotsHit: null,
            moreCornersHit: null,
            morePossessionHit: null,
            moreFoulsHit: null,
            moreCardsHit: null,
            moreOffsidesHit: null,
            moreSavesHit: null,
          },
        });
        reset++;
        console.log(`[Reverify] Fixture ${externalFixtureId} reseteado — status actual: ${statusShort}, ${resetResult.count} predicciones afectadas`);
      }
    } catch (err) {
      // No frenar el loop si una verificación falla
      console.warn(`[Reverify] Error verificando fixture ${externalFixtureId}: ${err.message}`);
    }
  }

  if (reset > 0) {
    // Recalcular leaderboards si hubo resets
    await recalculateAllLeaderboards();
  }

  return { checked, reset };
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
