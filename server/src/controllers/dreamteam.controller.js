import prisma from '../config/database.js';
import { BadRequestError } from '../utils/errors.js';

export async function getPlayers(req, res, next) {
  try {
    const players = await prisma.player.findMany({
      orderBy: { price: 'desc' }
    });
    res.json(players);
  } catch (err) { next(err); }
}

export async function getMyDreamTeam(req, res, next) {
  try {
    const dreamTeam = await prisma.dreamTeam.findUnique({
      where: { userId: req.user.id },
      include: {
        gk: true,
        def1: true, def2: true,
        mid1: true, mid2: true,
        fwd1: true, fwd2: true,
      }
    });
    res.json(dreamTeam || { formation: '1-2-1' });
  } catch (err) { next(err); }
}

export async function saveDreamTeam(req, res, next) {
  try {
    const { formation, players } = req.body;
    // players should be an object mapping slots to IDs: { gkId: 1, def1Id: 2, ... }
    
    // validate formation constraints? We can just save it for now
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
      where: { userId: req.user.id },
      update: data,
      create: { ...data, userId: req.user.id }
    });

    res.json(team);
  } catch (err) { next(err); }
}
