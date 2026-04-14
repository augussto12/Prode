import prisma from '../config/database.js';

function getMatchResult(match) {
  if (match.homeGoals > match.awayGoals) return 'HOME';
  if (match.homeGoals < match.awayGoals) return 'AWAY';
  return 'DRAW';
}

export function calculatePredictionPoints(prediction, match, config) {
  let points = 0;

  // 1. Exact Score (default 10 pts)
  if (
    prediction.homeGoals !== null &&
    prediction.awayGoals !== null &&
    prediction.homeGoals === match.homeGoals &&
    prediction.awayGoals === match.awayGoals
  ) {
    points += config.exactScore;
  }

  // 2. Correct Winner/Draw (default 3 pts)
  const actualResult = getMatchResult(match);
  if (prediction.winner && prediction.winner === actualResult) {
    points += config.correctWinner;
  }

  // 3. Double Chance (default 1 pt)
  if (prediction.doubleChance) {
    const dc = prediction.doubleChance;
    if (
      (dc === '1X' && (actualResult === 'HOME' || actualResult === 'DRAW')) ||
      (dc === '2X' && (actualResult === 'AWAY' || actualResult === 'DRAW')) ||
      (dc === '12' && (actualResult === 'HOME' || actualResult === 'AWAY'))
    ) {
      points += config.doubleChance;
    }
  }

  // 4. BTTS (default 2 pts)
  if (prediction.btts !== null && prediction.btts !== undefined) {
    const actualBtts = match.homeGoals > 0 && match.awayGoals > 0;
    if (prediction.btts === actualBtts) {
      points += config.btts;
    }
  }

  // 5. Over/Under 2.5 (default 2 pts)
  if (prediction.overUnder25) {
    const totalGoals = match.homeGoals + match.awayGoals;
    const actualOU = totalGoals > 2.5 ? 'OVER' : 'UNDER';
    if (prediction.overUnder25 === actualOU) {
      points += config.overUnder;
    }
  }

  // 6. More Shots (default 2 pts)
  if (prediction.moreShots && match.homeShots !== null && match.awayShots !== null) {
    const actual =
      match.homeShots > match.awayShots ? 'HOME' :
      match.homeShots < match.awayShots ? 'AWAY' : 'EQUAL';
    if (prediction.moreShots === actual) {
      points += config.moreShots;
    }
  }

  // 7. More Corners (default 2 pts)
  if (prediction.moreCorners && match.homeCorners !== null && match.awayCorners !== null) {
    const actual =
      match.homeCorners > match.awayCorners ? 'HOME' :
      match.homeCorners < match.awayCorners ? 'AWAY' : 'EQUAL';
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

export async function calculateMatchScores(matchId) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== 'FINISHED') {
    throw new Error('Match not finished or not found');
  }

  // Get global scoring config
  const config = await prisma.scoringConfig.findFirst({ where: { id: 1 } });
  if (!config) throw new Error('No scoring config found');

  // Get all predictions for this match
  const predictions = await prisma.prediction.findMany({
    where: { matchId, isCalculated: false },
  });

  let calculated = 0;
  for (const prediction of predictions) {
    const points = calculatePredictionPoints(prediction, match, config);
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { pointsEarned: points, isCalculated: true },
    });
    calculated++;
  }

  // Update leaderboards for ALL groups
  await recalculateAllLeaderboards();

  return { matchId, calculated };
}

export async function recalculateAllLeaderboards() {
  // Get all group memberships
  const groupUsers = await prisma.groupUser.findMany({
    include: { user: { select: { id: true } } },
  });

  for (const gu of groupUsers) {
    // Sum all calculated predictions for this user
    const result = await prisma.prediction.aggregate({
      where: { userId: gu.userId, isCalculated: true },
      _sum: { pointsEarned: true },
    });

    await prisma.groupUser.update({
      where: { id: gu.id },
      data: { totalPoints: result._sum.pointsEarned || 0 },
    });
  }
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
