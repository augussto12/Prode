import prisma from '../config/database.js';

export async function getMyOutrights(req, res, next) {
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
}

export async function saveOutrights(req, res, next) {
  try {
    const { competitionId, championTeam, runnerUpTeam, topScorerId, bestPlayerId } = req.body;

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
}
