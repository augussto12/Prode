import * as matchService from '../services/match.service.js';
import * as syncService from '../services/sync.service.js';
import prisma from '../config/database.js';

export async function getAll(req, res, next) {
  try {
    const matches = await matchService.getAllMatches(req.query);
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getToday(req, res, next) {
  try {
    const matches = await matchService.getTodayMatches();
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const match = await matchService.getMatchById(Number(req.params.id));
    res.json(match);
  } catch (err) { next(err); }
}

export async function getByStage(req, res, next) {
  try {
    const matches = await matchService.getMatchesByStage(req.params.stage);
    res.json(matches);
  } catch (err) { next(err); }
}

export async function getTeams(req, res, next) {
  try {
    const teams = await matchService.getAllTeams();
    res.json(teams);
  } catch (err) { next(err); }
}

export async function getMatchDetail(req, res, next) {
  try {
    const matchId = Number(req.params.id);
    const detail = await syncService.syncMatchDetail(matchId);
    
    // También devolver datos básicos del partido
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    
    res.json({ match, ...detail });
  } catch (err) { next(err); }
}

export async function getTeamSquad(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: {
          orderBy: [
            { position: 'asc' },
            { number: 'asc' },
          ],
        },
      },
    });
    
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(team);
  } catch (err) { next(err); }
}
