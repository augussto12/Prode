import prisma from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { recalculateAllLeaderboards } from './scoring.service.js';

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export async function createGroup(userId, data) {
  if (!data.competitionId) {
    throw new BadRequestError('competitionId es requerido para crear un grupo');
  }

  // Transacción: crear grupo + membresía admin atómicamente
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic || false,
        joinPolicy: data.joinPolicy || 'OPEN_WITH_CODE',
        createdById: userId,
        competitionId: Number(data.competitionId),
        allowMoreShots: false,
        allowMoreCorners: false,
        allowMorePossession: false,
        allowMoreFouls: false,
        allowMoreCards: false,
        allowMoreOffsides: false,
        allowMoreSaves: false,
      },
    });

    // Creator joins as admin
    await tx.groupUser.create({
      data: { userId, groupId: group.id, isAdmin: true },
    });

    return group;
  });
}

export async function getMyGroups(userId) {
  const memberships = await prisma.groupUser.findMany({
    where: { userId, isBanned: false },
    include: {
      group: {
        include: {
          _count: { select: { groupUsers: { where: { isBanned: false } } } },
          competition: { select: { id: true, externalId: true, season: true, name: true, logo: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.group,
    memberCount: m.group._count.groupUsers,
    isAdmin: m.isAdmin,
    totalPoints: m.totalPoints,
  }));
}

export async function getGroupById(groupId, userId) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { 
      _count: { select: { groupUsers: { where: { isBanned: false } } } },
      competition: { select: { id: true, externalId: true, season: true, name: true, logo: true } },
      messages: {
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, displayName: true, role: true, themeId: true } }
        }
      }
    },
  });
  if (!group) throw new NotFoundError('Grupo no encontrado');

  // Check membership
  const membership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });

  if (membership?.isBanned) throw new ForbiddenError('Fuiste baneado de este grupo');

  return { ...group, memberCount: group._count.groupUsers, isMember: !!membership, isAdmin: membership?.isAdmin };
}

export async function joinGroup(userId, inviteCode) {
  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) throw new NotFoundError('Código de invitación inválido');

  const existing = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId, groupId: group.id } },
  });

  // Si está baneado, no puede volver a entrar
  if (existing && existing.isBanned) {
    throw new ForbiddenError('Fuiste baneado de este grupo. Contacta al admin para que te desbanee.');
  }

  if (existing) throw new BadRequestError('Ya sos miembro de este grupo');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!user) throw new NotFoundError('Usuario no encontrado');

  const normalizedUsername = normalizeUsername(user.username);
  let invite = null;

  if (group.joinPolicy !== 'OPEN_WITH_CODE') {
    invite = await prisma.groupInvite.findUnique({
      where: {
        groupId_normalizedUsername: {
          groupId: group.id,
          normalizedUsername,
        },
      },
    });

    if (!invite || invite.status === 'REVOKED') {
      throw new ForbiddenError('No estas habilitado para entrar a este grupo');
    }

    if (group.joinPolicy === 'INVITE_ONLY' && invite.status !== 'PENDING') {
      throw new ForbiddenError('Tu invitacion ya fue usada o no esta activa');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupUser.create({
      data: { userId, groupId: group.id },
    });

    if (invite && invite.status === 'PENDING') {
      await tx.groupInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedById: userId,
          acceptedAt: new Date(),
        },
      });
    }
  });

  return group;
}

export async function leaveGroup(userId, groupId) {
  const membership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) throw new NotFoundError('No sos miembro de este grupo');

  await prisma.groupUser.delete({
    where: { userId_groupId: { userId, groupId } },
  });
}

export async function deleteGroup(userId, groupId) {
  const membership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership || !membership.isAdmin) throw new ForbiddenError('Solo el admin puede eliminar el grupo');

  await prisma.group.delete({
    where: { id: groupId },
  });
}

export async function getLeaderboard(groupId) {
  const members = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
    orderBy: { totalPoints: 'desc' },
  });

  return members.map((m, index) => ({
    rank: index + 1,
    userId: m.user.id,
    username: m.user.username,
    displayName: m.user.displayName,
    avatar: m.user.avatar,
    totalPoints: m.totalPoints,
    isAdmin: m.isAdmin,
  }));
}

export async function updateGroupTheme(groupId, userId, themeData) {
  const membership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership || !membership.isAdmin) {
    throw new ForbiddenError('Solo los admins del grupo pueden cambiar el tema');
  }

  const data = {};
  
  if (themeData.name !== undefined) data.name = themeData.name;
  if (themeData.description !== undefined) data.description = themeData.description;
  if (themeData.joinPolicy !== undefined) data.joinPolicy = themeData.joinPolicy;
  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data,
  });

  // Re-calcular los puntos ya que las reglas del grupo pudieron cambiar
  await recalculateAllLeaderboards();

  return updatedGroup;
}

export async function getPublicGroups() {
  return prisma.group.findMany({
    where: { isPublic: true },
    include: { _count: { select: { groupUsers: { where: { isBanned: false } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

function formatGroupInvite(invite) {
  return {
    id: invite.id,
    groupId: invite.groupId,
    username: invite.username,
    normalizedUsername: invite.normalizedUsername,
    status: invite.status,
    invitedBy: invite.invitedBy || null,
    acceptedBy: invite.acceptedBy || null,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
  };
}

export async function getGroupInvites(groupId) {
  const invites = await prisma.groupInvite.findMany({
    where: {
      groupId,
      status: { not: 'REVOKED' },
    },
    include: {
      invitedBy: { select: { id: true, username: true, displayName: true } },
      acceptedBy: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return invites.map(formatGroupInvite);
}

export async function addGroupInvite(groupId, username, invitedById) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    throw new BadRequestError('Username requerido');
  }

  const invite = await prisma.groupInvite.upsert({
    where: {
      groupId_normalizedUsername: {
        groupId,
        normalizedUsername,
      },
    },
    update: {
      username,
      invitedById,
      status: 'PENDING',
      acceptedById: null,
      acceptedAt: null,
    },
    create: {
      groupId,
      username,
      normalizedUsername,
      invitedById,
    },
    include: {
      invitedBy: { select: { id: true, username: true, displayName: true } },
      acceptedBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  return formatGroupInvite(invite);
}

export async function revokeGroupInvite(groupId, inviteId) {
  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    throw new BadRequestError('ID de invitacion invalido');
  }

  const invite = await prisma.groupInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.groupId !== groupId) {
    throw new NotFoundError('Invitacion no encontrada');
  }

  await prisma.groupInvite.update({
    where: { id: inviteId },
    data: { status: 'REVOKED' },
  });
}

// --- BAN SYSTEM ---

export async function removeMember(groupId, userIdToKick, requestingUserId) {
  const adminMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: requestingUserId, groupId } },
  });
  if (!adminMembership || !adminMembership.isAdmin) {
    throw new ForbiddenError('Solo los admins del grupo pueden expulsar miembros');
  }

  const targetMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: userIdToKick, groupId } },
  });
  if (!targetMembership) throw new NotFoundError('El usuario no es miembro de este grupo');
  if (targetMembership.isAdmin && targetMembership.userId !== requestingUserId) {
    throw new ForbiddenError('No podés banear a otro admin');
  }

  // Soft delete: marcar como baneado en vez de borrar
  await prisma.groupUser.update({
    where: { userId_groupId: { userId: userIdToKick, groupId } },
    data: { isBanned: true, bannedAt: new Date() },
  });
}

export async function getBannedMembers(groupId, requestingUserId) {
  const adminMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: requestingUserId, groupId } },
  });
  if (!adminMembership || !adminMembership.isAdmin) {
    throw new ForbiddenError('Solo los admins del grupo pueden ver los baneados');
  }

  const banned = await prisma.groupUser.findMany({
    where: { groupId, isBanned: true },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
    orderBy: { bannedAt: 'desc' },
  });

  return banned.map((m) => ({
    userId: m.user.id,
    username: m.user.username,
    displayName: m.user.displayName,
    avatar: m.user.avatar,
    bannedAt: m.bannedAt,
  }));
}

export async function unbanMember(groupId, userIdToUnban, requestingUserId) {
  const adminMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: requestingUserId, groupId } },
  });
  if (!adminMembership || !adminMembership.isAdmin) {
    throw new ForbiddenError('Solo los admins del grupo pueden desbanear miembros');
  }

  const targetMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: userIdToUnban, groupId } },
  });
  if (!targetMembership || !targetMembership.isBanned) {
    throw new NotFoundError('El usuario no está baneado de este grupo');
  }

  await prisma.groupUser.update({
    where: { userId_groupId: { userId: userIdToUnban, groupId } },
    data: { isBanned: false, bannedAt: null },
  });
}

// --- PREDICTIONS ---
export async function getMatchPredictions(groupId, externalFixtureId) {
  // Obtener los miembros del grupo
  const members = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    select: { userId: true, user: { select: { displayName: true, avatar: true } }, totalPoints: true }
  });

  const userIds = members.map(m => m.userId);

  // Traer predicciones para este partido específicas de estos usuarios
  const predictions = await prisma.prediction.findMany({
    where: {
      externalFixtureId,
      userId: { in: userIds }
    }
  });

  // Mapear combinando predicción e info de usuario, ordenados por puntos de predicción o totalPoints si no hay predi
  const result = members.map(m => {
    const p = predictions.find(pred => pred.userId === m.userId);
    return {
      user: m.user,
      prediction: p || null,
      totalPoints: m.totalPoints
    };
  });

  return result.sort((a, b) => {
    const ptsA = a.prediction?.pointsEarned || 0;
    const ptsB = b.prediction?.pointsEarned || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return b.totalPoints - a.totalPoints;
  });
}

/**
 * Reinicia todos los puntajes de un grupo:
 * 1. Marca como isCalculated=false TODAS las predicciones de la competición del grupo
 * 2. Pone en 0 los puntos de cada predicción
 * 3. Reinicia el leaderboard (totalPoints=0 en GroupUser)
 */
export async function resetGroupScores(groupId, requestingUserId) {
  const adminMembership = await prisma.groupUser.findUnique({
    where: { userId_groupId: { userId: requestingUserId, groupId } },
  });
  if (!adminMembership || !adminMembership.isAdmin) {
    throw new ForbiddenError('Solo los admins del grupo pueden reiniciar puntajes');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Grupo no encontrado');

  // Obtener todos los userIds del grupo (no baneados)
  const members = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    select: { userId: true },
  });
  const userIds = members.map(m => m.userId);

  // 1. Resetear predicciones de esos usuarios para esa competición
  const resetResult = await prisma.prediction.updateMany({
    where: {
      userId: { in: userIds },
      competitionId: group.competitionId,
    },
    data: {
      pointsEarned: 0,
      basePoints: 0,
      isCalculated: false,
      moreShotsHit: null,
      moreCornersHit: null,
      morePossessionHit: null,
      moreFoulsHit: null,
      moreCardsHit: null,
      moreOffsidesHit: null,
      moreSavesHit: null,
    },
  });

  // 2. Resetear leaderboard del grupo
  await prisma.groupUser.updateMany({
    where: { groupId, isBanned: false },
    data: { totalPoints: 0 },
  });

  console.log(`[Group] ✓ Puntajes reiniciados grupo ${groupId} — ${resetResult.count} predicciones, ${userIds.length} miembros`);

  return { predictionsReset: resetResult.count, membersReset: userIds.length };
}

