import * as scoringService from '../services/scoring.service.js';
import prisma from '../config/database.js';

export async function calculateScores(req, res, next) {
  try {
    const result = await scoringService.scorePendingPredictions();
    res.json(result);
  } catch (err) { next(err); }
}

export async function recalculateLeaderboards(req, res, next) {
  try {
    await scoringService.recalculateAllLeaderboards();
    res.json({ message: 'Leaderboards recalculados correctamente desde las predicciones existentes.' });
  } catch (err) { next(err); }
}

export async function getUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, displayName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const targetId = Number(req.params.id);
    if (!['PLAYER', 'ADMIN', 'SUPERADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No podés cambiarte el rol a vos mismo' });
    }
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, email: true, username: true, displayName: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
}

export async function deleteUser(req, res, next) {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    }
    await prisma.user.delete({ where: { id: targetId } });
    res.json({ message: 'Usuario eliminado' });
  } catch (err) { next(err); }
}

export async function getScoringConfig(req, res, next) {
  try {
    const config = await scoringService.getScoringConfig();
    res.json(config);
  } catch (err) { next(err); }
}

export async function updateScoringConfig(req, res, next) {
  try {
    const config = await scoringService.updateScoringConfig(req.body);
    res.json(config);
  } catch (err) { next(err); }
}

export async function getCronLogs(req, res, next) {
  try {
    const { page = 1, limit = 50, module } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereParams = {};
    if (module) {
      whereParams.module = module;
    }

    const [logs, total] = await Promise.all([
      prisma.cronJobLog.findMany({
        where: whereParams,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip
      }),
      prisma.cronJobLog.count({ where: whereParams })
    ]);

    res.json({
      data: logs,
      meta: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) { next(err); }
}
