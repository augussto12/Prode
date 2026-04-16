import prisma from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export async function getAllMatches({ status, stage, date, competitionId } = {}) {
  const where = {};
  if (status) where.status = status;
  if (stage) where.stage = stage;
  if (competitionId) where.competitionId = Number(competitionId);
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
    include: {
      competition: { select: { id: true, name: true, logo: true } },
    },
  });
}

export async function getTodayMatches(competitionId = null) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const where = { matchDate: { gte: start, lte: end } };
  if (competitionId) where.competitionId = Number(competitionId);

  return prisma.match.findMany({
    where,
    orderBy: { matchDate: 'asc' },
  });
}

export async function getMatchById(id) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      competition: { select: { id: true, name: true, logo: true } },
    },
  });
  if (!match) throw new NotFoundError('Match not found');
  return match;
}

export async function getMatchesByStage(stage, competitionId = null) {
  const where = { stage };
  if (competitionId) where.competitionId = Number(competitionId);

  return prisma.match.findMany({
    where,
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

export async function getAllTeams(competitionId = null) {
  // Primero intentar desde tabla Team (datos de API)
  const apiTeams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
  if (apiTeams.length > 0) {
    return apiTeams.map(t => ({
      id: t.id,
      externalId: t.externalId,
      name: t.name,
      code: t.code,
      logo: t.logo,
      flag: t.flag || t.logo,
      country: t.country,
    }));
  }

  // Fallback: derivar de los partidos
  const where = {};
  if (competitionId) where.competitionId = Number(competitionId);

  const matches = await prisma.match.findMany({
    where,
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
