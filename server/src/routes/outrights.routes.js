import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();
router.use(authenticate);

// Get User's Outright Predictions for a competition
router.get('/', async (req, res, next) => {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const outrights = await prisma.outrightPrediction.findUnique({
      where: {
        userId_competitionId: {
          userId: req.user.id,
          competitionId: Number(competitionId),
        },
      },
    });
    res.json(outrights || {});
  } catch (err) { next(err); }
});

// Save or Update User's Outright Predictions
router.post('/', async (req, res, next) => {
  try {
    const { competitionId, championTeam, runnerUpTeam, topScorerId, bestPlayerId } = req.body;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }

    const outrights = await prisma.outrightPrediction.upsert({
      where: {
        userId_competitionId: {
          userId: req.user.id,
          competitionId: Number(competitionId),
        },
      },
      update: {
        championTeam: championTeam || null,
        runnerUpTeam: runnerUpTeam || null,
        topScorerId: topScorerId ? Number(topScorerId) : null,
        bestPlayerId: bestPlayerId ? Number(bestPlayerId) : null,
      },
      create: {
        userId: req.user.id,
        competitionId: Number(competitionId),
        championTeam: championTeam || null,
        runnerUpTeam: runnerUpTeam || null,
        topScorerId: topScorerId ? Number(topScorerId) : null,
        bestPlayerId: bestPlayerId ? Number(bestPlayerId) : null,
      }
    });

    res.json(outrights);
  } catch (err) { next(err); }
});

export default router;
