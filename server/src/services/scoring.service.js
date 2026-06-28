import prisma from '../config/database.js';
import * as footballApi from '../services/football-api.service.js';
import { cachedApiCall } from '../services/cache.service.js';

const API_FOOTBALL_SOURCE = 'api-football';
const FINISHED_STATUS_SHORTS = new Set(['FT', 'AET', 'PEN']);

export function isFinishedFixture(fixtureData) {
  return FINISHED_STATUS_SHORTS.has(fixtureData?.fixture?.status?.short);
}

export function hasFinalFixtureScore(fixtureData) {
  const { home: homeGoals, away: awayGoals } = getRegulationScore(fixtureData);
  return (
    homeGoals !== null &&
    homeGoals !== undefined &&
    awayGoals !== null &&
    awayGoals !== undefined
  );
}

export function getRegulationScore(fixtureData) {
  const matchData = fixtureData?.score ? fixtureData : fixtureData?.fixture || fixtureData;
  const fulltimeHome = matchData?.score?.fulltime?.home;
  const fulltimeAway = matchData?.score?.fulltime?.away;

  if (
    fulltimeHome !== null &&
    fulltimeHome !== undefined &&
    fulltimeAway !== null &&
    fulltimeAway !== undefined
  ) {
    return { home: fulltimeHome, away: fulltimeAway, source: 'fulltime' };
  }

  return {
    home: matchData?.goals?.home,
    away: matchData?.goals?.away,
    source: 'goals',
  };
}

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
  const { home: actualHomeGoals, away: actualAwayGoals } = getRegulationScore(fixtureData);

  if (
    actualHomeGoals === null ||
    actualHomeGoals === undefined ||
    actualAwayGoals === null ||
    actualAwayGoals === undefined
  ) {
    return { points: 0, basePoints: 0, ...legacyHitFields };
  }

  if (
    prediction.homeGoals === null ||
    prediction.homeGoals === undefined ||
    prediction.awayGoals === null ||
    prediction.awayGoals === undefined
  ) {
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
 * Fetch fixture data directly from API-Football for scoring.
 * Scoring must not share cache keys with match detail responses, because
 * those endpoints cache a different object shape.
 */
async function getFixtureFromApi(fixtureId, { fresh = false } = {}) {
  const fetchFixture = async () => {
    const result = await footballApi.fetchFixtureById(fixtureId);
    return result.response?.[0] || null;
  };

  if (fresh) {
    return fetchFixture();
  }

  return cachedApiCall(`api-football:fixture:raw:${fixtureId}`, 30, fetchFixture);
}

async function scoreFixturePredictions(externalFixtureId, fixtureData, config, filters = {}) {
  if (!hasFinalFixtureScore(fixtureData)) return 0;

  const where = {
    externalFixtureId,
    isCalculated: false,
  };

  if (filters.competitionId) where.competitionId = filters.competitionId;
  if (filters.source) where.source = filters.source;

  const fixturePredictions = await prisma.prediction.findMany({ where });
  if (fixturePredictions.length === 0) return 0;

  await prisma.$transaction(
    fixturePredictions.map((prediction) => {
      const result = calculatePredictionPoints(prediction, fixtureData, config);

      return prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          pointsEarned: result.points,
          basePoints: result.basePoints,
          ...legacyHitFields,
          isCalculated: true,
        },
      });
    }),
  );

  return fixturePredictions.length;
}

/**
 * Main batch scoring function.
 * 1. Finds all pending predictions
 * 2. Fetches fixture result from API
 * 3. Scores if finished
 * 4. Recalculates leaderboards
 */
export async function scorePendingPredictions() {
  const config = await getScoringConfig();

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
    const fixtureData = await getFixtureFromApi(externalFixtureId, { fresh: true });
    if (!fixtureData) continue;

    const isFinished = isFinishedFixture(fixtureData);
    if (!isFinished) continue;
    if (!hasFinalFixtureScore(fixtureData)) {
      console.warn(`[Scoring] Fixture ${externalFixtureId} finalizado sin goles publicados; se reintentara en el proximo ciclo`);
      continue;
    }

    const score = getRegulationScore(fixtureData);
    console.log(`[Scoring] ${fixtureData.teams?.home?.name} ${score.home}-${score.away} ${fixtureData.teams?.away?.name} (90m)`);

    totalCalculated += await scoreFixturePredictions(externalFixtureId, fixtureData, config);
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
 * Lightweight World Cup watcher.
 * Fetches the competition fixture list once, scores only finished fixtures
 * that still have pending predictions, then rebuilds leaderboards.
 */
export async function scoreFinishedCompetitionFixtures({ leagueId = 1, season = 2026 } = {}) {
  const numericLeagueId = Number(leagueId);
  const numericSeason = Number(season);

  if (!Number.isFinite(numericLeagueId) || !Number.isFinite(numericSeason)) {
    throw new Error(
      `League/season invalidos para scoring automatico: league=${leagueId}, season=${season}`,
    );
  }

  const competition = await prisma.competition.findUnique({
    where: {
      externalId_season: {
        externalId: numericLeagueId,
        season: numericSeason,
      },
    },
  });

  if (!competition) {
    return {
      message: `No existe una competencia local para liga ${numericLeagueId}, temporada ${numericSeason}.`,
      checked: 0,
      finished: 0,
      scorableFinished: 0,
      fixturesProcessed: 0,
      predictionsCalculated: 0,
    };
  }

  const result = await footballApi.fetchFixtures(numericLeagueId, numericSeason);
  const fixtures = result.response || [];
  const finishedFixtures = fixtures.filter(isFinishedFixture);
  const scorableFinishedFixtures = finishedFixtures.filter(hasFinalFixtureScore);
  const fixtureIds = scorableFinishedFixtures
    .map((fixture) => String(fixture.fixture?.id || ''))
    .filter(Boolean);

  if (fixtureIds.length === 0) {
    return {
      message: `No hay partidos terminados con resultado para ${competition.name}.`,
      checked: fixtures.length,
      finished: finishedFixtures.length,
      scorableFinished: 0,
      fixturesProcessed: 0,
      predictionsCalculated: 0,
    };
  }

  const pendingFixtures = await prisma.prediction.findMany({
    where: {
      competitionId: competition.id,
      source: API_FOOTBALL_SOURCE,
      isCalculated: false,
      externalFixtureId: { in: fixtureIds },
    },
    select: { externalFixtureId: true },
    distinct: ['externalFixtureId'],
  });

  if (pendingFixtures.length === 0) {
    return {
      message: `No hay predicciones pendientes para partidos terminados de ${competition.name}.`,
      checked: fixtures.length,
      finished: finishedFixtures.length,
      scorableFinished: scorableFinishedFixtures.length,
      fixturesProcessed: 0,
      predictionsCalculated: 0,
    };
  }

  const config = await getScoringConfig();
  const fixturesById = new Map(
    scorableFinishedFixtures.map((fixture) => [String(fixture.fixture?.id), fixture]),
  );
  let totalCalculated = 0;
  let fixturesProcessed = 0;

  for (const { externalFixtureId } of pendingFixtures) {
    const fixtureData = fixturesById.get(String(externalFixtureId));
    if (!fixtureData) continue;

    const calculated = await scoreFixturePredictions(externalFixtureId, fixtureData, config, {
      competitionId: competition.id,
      source: API_FOOTBALL_SOURCE,
    });

    if (calculated > 0) {
      fixturesProcessed++;
      totalCalculated += calculated;
      const score = getRegulationScore(fixtureData);
      console.log(
        `[Auto scoring] ${fixtureData.teams?.home?.name} ${score.home}-${score.away} ${fixtureData.teams?.away?.name} (90m): ${calculated} predicciones`,
      );
    }
  }

  if (totalCalculated > 0) {
    await recalculateAllLeaderboards();
  }

  return {
    message: `Auto-scoring ${competition.name}: ${fixturesProcessed} partidos, ${totalCalculated} predicciones calculadas.`,
    checked: fixtures.length,
    finished: finishedFixtures.length,
    scorableFinished: scorableFinishedFixtures.length,
    fixturesProcessed,
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
  const config = await getScoringConfig();

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
  let corrected = 0;

  for (const { externalFixtureId } of recentFixtures) {
    checked++;
    try {
      const result = await footballApi.fetchFixtureById(externalFixtureId);
      const fixtureData = result.response?.[0];
      if (!fixtureData) continue;

      const statusShort = fixtureData.fixture?.status?.short;
      const isFinished = isFinishedFixture(fixtureData);

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
        continue;
      }

      if (!hasFinalFixtureScore(fixtureData)) {
        console.warn(`[Reverify] Fixture ${externalFixtureId} finalizado sin goles publicados; se mantiene el calculo anterior`);
        continue;
      }

      const predictions = await prisma.prediction.findMany({
        where: { externalFixtureId, isCalculated: true },
      });

      for (const prediction of predictions) {
        const result = calculatePredictionPoints(prediction, fixtureData, config);
        if (
          prediction.pointsEarned !== result.points ||
          prediction.basePoints !== result.basePoints
        ) {
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: {
              pointsEarned: result.points,
              basePoints: result.basePoints,
              ...legacyHitFields,
            },
          });
          corrected++;
        }
      }
    } catch (err) {
      console.warn(`[Reverify] Error verificando fixture ${externalFixtureId}: ${err.message}`);
    }
  }

  if (reset > 0 || corrected > 0) {
    await recalculateAllLeaderboards();
  }

  return { checked, reset, corrected };
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
