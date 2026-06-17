import * as scoringService from '../services/scoring.service.js';
import * as outrightsService from '../services/outrights.service.js';
import * as jokerService from '../services/joker.service.js';
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

export async function getJokerState(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }
    const state = await jokerService.getAdminJokerState(Number(competitionId));
    res.json(state);
  } catch (err) { next(err); }
}

export async function updateJokerConfig(req, res, next) {
  try {
    const config = await jokerService.updateJokerConfig(req.user.id, req.body);
    res.json(config);
  } catch (err) { next(err); }
}

export async function createJokerGrant(req, res, next) {
  try {
    const grant = await jokerService.createJokerGrant(req.user.id, req.body);
    res.status(201).json(grant);
  } catch (err) { next(err); }
}

export async function updateJokerGrant(req, res, next) {
  try {
    const grant = await jokerService.setJokerGrantActive(
      Number(req.params.id),
      req.body.isActive,
    );
    res.json(grant);
  } catch (err) { next(err); }
}

export async function getOutrightResult(req, res, next) {
  try {
    const { competitionId } = req.query;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }
    const data = await outrightsService.getAdminResult(Number(competitionId));
    res.json(data);
  } catch (err) { next(err); }
}

export async function updateOutrightResult(req, res, next) {
  try {
    const result = await outrightsService.saveAdminResult(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

export async function calculateOutrightScores(req, res, next) {
  try {
    const { competitionId } = req.body;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }
    const result = await outrightsService.calculateOutrightScores(Number(competitionId));
    res.json(result);
  } catch (err) { next(err); }
}

export async function syncOutrightOptions(req, res, next) {
  try {
    const { competitionId, offset, limit } = req.body;
    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId es requerido' });
    }
    const result = await outrightsService.syncCompetitionTeamsAndPlayers(Number(competitionId), { offset, limit });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getScoringDiagnostics(req, res, next) {
  try {
    const [pending, calculated, recentCrons, groupCount, activeMembers] = await Promise.all([
      prisma.prediction.count({ where: { isCalculated: false } }),
      prisma.prediction.count({ where: { isCalculated: true } }),
      prisma.cronJobLog.findMany({
        where: { module: 'Prode' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.group.count(),
      prisma.groupUser.count({ where: { isBanned: false } }),
    ]);

    res.json({
      predictions: { pending, calculated, total: pending + calculated },
      groups: groupCount,
      activeMembers,
      recentCrons,
    });
  } catch (err) { next(err); }
}

export async function getGroups(req, res, next) {
  try {
    const groups = await prisma.group.findMany({
      include: {
        competition: { select: { id: true, name: true, logo: true } },
        _count: { select: { groupUsers: { where: { isBanned: false } } } },
        groupUsers: {
          where: { isBanned: false },
          orderBy: { totalPoints: 'desc' },
          take: 1,
          include: { user: { select: { displayName: true, username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      competition: g.competition,
      memberCount: g._count.groupUsers,
      topScorer: g.groupUsers[0] ? {
        displayName: g.groupUsers[0].user.displayName,
        username: g.groupUsers[0].user.username,
        totalPoints: g.groupUsers[0].totalPoints,
      } : null,
      createdAt: g.createdAt,
    })));
  } catch (err) { next(err); }
}

export async function getGroupDetails(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        competition: { select: { id: true, name: true, logo: true } },
        groupUsers: {
          include: { user: { select: { id: true, displayName: true, username: true, avatar: true } } },
          orderBy: { totalPoints: 'desc' },
        },
      },
    });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json(group);
  } catch (err) { next(err); }
}

export async function adjustMemberPoints(req, res, next) {
  try {
    const groupId = Number(req.params.groupId);
    const userId = Number(req.params.userId);
    const { totalPoints } = req.body;

    if (typeof totalPoints !== 'number' || totalPoints < 0 || !Number.isInteger(totalPoints)) {
      return res.status(400).json({ error: 'totalPoints debe ser un entero mayor o igual a 0' });
    }

    const membership = await prisma.groupUser.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) return res.status(404).json({ error: 'El usuario no es miembro de este grupo' });

    const updated = await prisma.groupUser.update({
      where: { userId_groupId: { userId, groupId } },
      data: { totalPoints },
      include: { user: { select: { id: true, displayName: true, username: true } } },
    });

    console.log(`[Admin] Puntos ajustados manualmente: userId=${userId} groupId=${groupId} pts=${totalPoints} by superadmin=${req.user.id}`);
    res.json({ success: true, member: updated });
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
