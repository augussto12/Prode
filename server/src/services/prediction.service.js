import prisma from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export async function upsertPrediction(userId, matchId, data) {
  // Verify match exists and hasn't started
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new NotFoundError('Match not found');
  
  if (match.status !== 'SCHEDULED') {
    throw new BadRequestError('Cannot predict after match has started');
  }
  
  // Bloqueo 5 minutos antes del partido (usa reloj del servidor, ignora cualquier timestamp del cliente)
  const now = new Date();
  const lockoutTime = new Date(match.matchDate);
  lockoutTime.setMinutes(lockoutTime.getMinutes() - 5);
  
  if (now >= lockoutTime) {
    throw new BadRequestError('Las predicciones se cierran 5 minutos antes del partido');
  }

  // Handle Joker logic - 1 per day
  if (data.isJoker) {
    const matchDateStart = new Date(match.matchDate);
    matchDateStart.setHours(0, 0, 0, 0);
    const matchDateEnd = new Date(match.matchDate);
    matchDateEnd.setHours(23, 59, 59, 999);

    const existingJokerForDay = await prisma.prediction.findFirst({
      where: {
        userId,
        isJoker: true,
        match: {
          matchDate: { gte: matchDateStart, lte: matchDateEnd }
        },
        NOT: { matchId } // exclude this current match if editing
      }
    });

    if (existingJokerForDay) {
      throw new BadRequestError('Ya usaste tu comodín x2 para esta fecha / día.');
    }
  }

  return prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId } },
    update: {
      homeGoals: data.homeGoals,
      awayGoals: data.awayGoals,
      winner: data.winner,
      doubleChance: data.doubleChance,
      btts: data.btts,
      overUnder25: data.overUnder25,
      moreShots: data.moreShots,
      moreCorners: data.moreCorners,
      isJoker: data.isJoker,
    },
    create: {
      userId,
      matchId,
      homeGoals: data.homeGoals,
      awayGoals: data.awayGoals,
      winner: data.winner,
      doubleChance: data.doubleChance,
      btts: data.btts,
      overUnder25: data.overUnder25,
      moreShots: data.moreShots,
      moreCorners: data.moreCorners,
      isJoker: data.isJoker || false,
    },
  });
}

export async function getMyPredictions(userId) {
  return prisma.prediction.findMany({
    where: { userId },
    include: { match: true },
    orderBy: { match: { matchDate: 'asc' } },
  });
}

export async function getPredictionsForMatch(matchId) {
  return prisma.prediction.findMany({
    where: { matchId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}

export async function getGroupPredictionsForMatch(matchId, groupId, requestingUserId) {
  // Verify match has started (predictions only visible post-kickoff)
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new NotFoundError('Match not found');

  // Get members of this group
  const groupMembers = await prisma.groupUser.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const memberIds = groupMembers.map((m) => m.userId);

  // If match hasn't started, only return the requesting user's prediction
  if (match.status === 'SCHEDULED' && new Date(match.matchDate) > new Date()) {
    return prisma.prediction.findMany({
      where: { matchId, userId: requestingUserId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    });
  }

  return prisma.prediction.findMany({
    where: { matchId, userId: { in: memberIds } },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
}
