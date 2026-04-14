import prisma from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export async function getAllMatches({ status, stage, date } = {}) {
  const where = {};
  if (status) where.status = status;
  if (stage) where.stage = stage;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.matchDate = { gte: start, lte: end };
  }

  return prisma.match.findMany({
    where,
    orderBy: { matchDate: 'asc' },
  });
}

export async function getTodayMatches() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return prisma.match.findMany({
    where: { matchDate: { gte: start, lte: end } },
    orderBy: { matchDate: 'asc' },
  });
}

export async function getMatchById(id) {
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) throw new NotFoundError('Match not found');
  return match;
}

export async function getMatchesByStage(stage) {
  return prisma.match.findMany({
    where: { stage },
    orderBy: { matchDate: 'asc' },
  });
}

export async function updateMatchResult(id, data) {
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) throw new NotFoundError('Match not found');

  return prisma.match.update({
    where: { id },
    data: {
      homeGoals: data.homeGoals,
      awayGoals: data.awayGoals,
      homeShots: data.homeShots,
      awayShots: data.awayShots,
      homeCorners: data.homeCorners,
      awayCorners: data.awayCorners,
      homePossession: data.homePossession,
      awayPossession: data.awayPossession,
      status: 'FINISHED',
    },
  });
}

export async function getAllTeams() {
  const matches = await prisma.match.findMany({
    select: { homeTeam: true, awayTeam: true, homeFlag: true, awayFlag: true },
  });
  
  const teamsMap = new Map();
  matches.forEach((m) => {
    teamsMap.set(m.homeTeam, m.homeFlag);
    teamsMap.set(m.awayTeam, m.awayFlag);
  });

  return Array.from(teamsMap.entries())
    .map(([name, flag]) => ({ name, flag }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
