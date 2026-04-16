import prisma from '../config/database.js';
import { BadRequestError } from '../utils/errors.js';

export async function getPlayers(req, res, next) {
  try {
    const { competitionId } = req.query;

    const players = await prisma.player.findMany({
      orderBy: { name: 'asc' },
      include: {
        team: { select: { name: true, logo: true } },
        stats: competitionId ? {
          where: { competitionId: Number(competitionId) },
        } : true,
      },
    });

    // Flatten stats for the requested competition
    const result = players.map(p => {
      const competitionStats = competitionId && p.stats?.length > 0 ? p.stats[0] : null;
      return {
        ...p,
        goals: competitionStats?.goals || 0,
        assists: competitionStats?.assists || 0,
        cleanSheets: competitionStats?.cleanSheets || 0,
        totalPoints: competitionStats?.totalPoints || 0,
        stats: undefined, // Remove raw stats array
      };
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function getMyDreamTeam(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const dreamTeam = await prisma.dreamTeam.findUnique({
      where: {
        userId_competitionId: {
          userId: req.user.id,
          competitionId: Number(competitionId),
        },
      },
      include: {
        gk: true,
        def1: true, def2: true,
        mid1: true, mid2: true,
        fwd1: true, fwd2: true,
      }
    });
    res.json(dreamTeam || { formation: '1-2-1', competitionId: Number(competitionId) });
  } catch (err) { next(err); }
}

export async function saveDreamTeam(req, res, next) {
  try {
    const { formation, players, competitionId } = req.body;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const data = {
      formation,
      gkId: players.gkId || null,
      def1Id: players.def1Id || null,
      def2Id: players.def2Id || null,
      mid1Id: players.mid1Id || null,
      mid2Id: players.mid2Id || null,
      fwd1Id: players.fwd1Id || null,
      fwd2Id: players.fwd2Id || null,
    };

    const team = await prisma.dreamTeam.upsert({
      where: {
        userId_competitionId: {
          userId: req.user.id,
          competitionId: Number(competitionId),
        },
      },
      update: data,
      create: { ...data, userId: req.user.id, competitionId: Number(competitionId) }
    });

    res.json(team);
  } catch (err) { next(err); }
}
