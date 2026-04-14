import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();
router.use(authenticate);

// Get User's Outright Predictions
router.get('/', async (req, res, next) => {
  try {
    const outrights = await prisma.outrightPrediction.findUnique({
      where: { userId: req.user.id }
    });
    res.json(outrights || {});
  } catch (err) { next(err); }
});

// Save or Update User's Outright Predictions
router.post('/', async (req, res, next) => {
  try {
    const data = req.body; // { championTeam, runnerUpTeam, topScorerId, bestPlayerId }
    
    // Convert string inputs that are empty to null if necessary, 
    // or just pass them along if the form strips them correctly.
    const outrights = await prisma.outrightPrediction.upsert({
      where: { userId: req.user.id },
      update: {
        championTeam: data.championTeam || null,
        runnerUpTeam: data.runnerUpTeam || null,
        topScorerId: data.topScorerId ? Number(data.topScorerId) : null,
        bestPlayerId: data.bestPlayerId ? Number(data.bestPlayerId) : null,
      },
      create: {
        userId: req.user.id,
        championTeam: data.championTeam || null,
        runnerUpTeam: data.runnerUpTeam || null,
        topScorerId: data.topScorerId ? Number(data.topScorerId) : null,
        bestPlayerId: data.bestPlayerId ? Number(data.bestPlayerId) : null,
      }
    });

    res.json(outrights);
  } catch (err) { next(err); }
});

export default router;
