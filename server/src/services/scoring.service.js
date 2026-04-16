import prisma from '../config/database.js';

function getMatchResult(match) {
  if (match.homeGoals > match.awayGoals) return 'HOME';
  if (match.homeGoals < match.awayGoals) return 'AWAY';
  return 'DRAW';
}

export function calculatePredictionPoints(prediction, match, config) {
  let points = 0;

  // Wait, if match doesn't have homeGoals/awayGoals recorded, we return 0.
  if (match.homeGoals === null || match.awayGoals === null) return 0;

  // Only calculate result points if prediction actually put goals.
  if (prediction.homeGoals !== null && prediction.awayGoals !== null) {
    const actualResult = getMatchResult(match);
    const predictedResult = prediction.homeGoals > prediction.awayGoals ? 'HOME' : prediction.homeGoals < prediction.awayGoals ? 'AWAY' : 'DRAW';

    const isExact = prediction.homeGoals === match.homeGoals && prediction.awayGoals === match.awayGoals;
    
    // 1. Result Sovereignty: You either get exact, or trend (winner). MUTUALLY EXCLUSIVE.
    if (isExact) {
      points += config.exactScore;
    } else if (predictedResult === actualResult) {
      points += config.correctWinner;
    }
  }

  // 2. Prop: More Shots (If API delivered the stat)
  if (prediction.moreShots && match.homeShots !== null && match.awayShots !== null) {
    const actual =
      match.homeShots > match.awayShots ? 'HOME' :
      match.homeShots < match.awayShots ? 'AWAY' : 'EQUAL';
    if (prediction.moreShots === actual) {
      points += config.moreShots;
    }
  }

  // 3. Prop: More Corners (If API delivered the stat)
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
  // Get all group memberships with their group's competitionId
  const groupUsers = await prisma.groupUser.findMany({
    include: {
      user: { select: { id: true } },
      group: { select: { competitionId: true } },
    },
  });

  for (const gu of groupUsers) {
    // Sum only predictions from matches of the SAME competition as the group
    const result = await prisma.prediction.aggregate({
      where: {
        userId: gu.userId,
        isCalculated: true,
        match: { competitionId: gu.group.competitionId },
      },
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
