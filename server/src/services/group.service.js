import prisma from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { recalculateAllLeaderboards } from './scoring.service.js';
import { cachedApiCall } from './cache.service.js';
import * as footballApi from './football-api.service.js';
import { getFixturePredictionWindow } from './phase-window.service.js';

const GROUP_PREDICTION_LOCKOUT_MINUTES = 5;
const NOT_STARTED_FIXTURE_STATUSES = new Set(['NS', 'TBD', 'PST']);

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

async function getFixtureFromApi(fixtureId) {
  return cachedApiCall(`api-football:fixture:raw:${fixtureId}`, 30, async () => {
    const result = await footballApi.fetchFixtureById(fixtureId);
    return result.response?.[0] || null;
  });
}

function getFixtureDate(fixture) {
  const raw = fixture?.fixture?.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasFixtureStarted(fixture, now = new Date()) {
  const statusShort = fixture?.fixture?.status?.short;
  if (statusShort && !NOT_STARTED_FIXTURE_STATUSES.has(statusShort)) return true;

  const fixtureDate = getFixtureDate(fixture);
  return Boolean(fixtureDate && now >= fixtureDate);
}

function getGroupPredictionVisibilityCutoff(fixture, predictionWindow = null) {
  if (predictionWindow?.phaseRule && predictionWindow.closesAt) {
    const closesAt = new Date(predictionWindow.closesAt);
    return Number.isNaN(closesAt.getTime()) ? null : closesAt;
  }

  const fixtureDate = getFixtureDate(fixture);
  if (!fixtureDate) return null;

  const cutoff = new Date(fixtureDate);
  cutoff.setMinutes(cutoff.getMinutes() - GROUP_PREDICTION_LOCKOUT_MINUTES);
  return cutoff;
}

function canRevealGroupMatchPredictions(fixture, predictionWindow = null, now = new Date()) {
  if (hasFixtureStarted(fixture, now)) return true;

  const cutoff = getGroupPredictionVisibilityCutoff(fixture, predictionWindow);
  if (!cutoff || now < cutoff) return false;

  if (predictionWindow?.phaseRule) {
    if (predictionWindow.previousFinished === false) return false;
    if (predictionWindow.canPredict === false && !predictionWindow.closesAt) return false;
  }

  return true;
}

export async function createGroup(userId, data) {
  if (!data.competitionId) {
    throw new BadRequestError('competitionId es requerido para crear un grupo');
  }

  // Transacción: crear grupo + membresía admin atómicamente
  const group = await prisma.$transaction(async (tx) => {
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

  await recalculateAllLeaderboards();
  return group;
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

  const groupIds = memberships.map((m) => m.groupId);
  const membersByGroup = new Map();

  if (groupIds.length > 0) {
    const groupMembers = await prisma.groupUser.findMany({
      where: { groupId: { in: groupIds }, isBanned: false },
      select: { groupId: true, userId: true, totalPoints: true, joinedAt: true },
      orderBy: [
        { groupId: 'asc' },
        { totalPoints: 'desc' },
        { joinedAt: 'asc' },
        { userId: 'asc' },
      ],
    });

    for (const member of groupMembers) {
      const members = membersByGroup.get(member.groupId) || [];
      members.push(member);
      membersByGroup.set(member.groupId, members);
    }
  }

  return memberships.map((m) => {
    const groupRank = (membersByGroup.get(m.groupId) || []).findIndex(
      (member) => member.userId === userId,
    );

    return {
      ...m.group,
      memberCount: m.group._count.groupUsers,
      isAdmin: m.isAdmin,
      totalPoints: m.totalPoints,
      rank: groupRank >= 0 ? groupRank + 1 : null,
    };
  });
}

export async function getGroupById(groupId, userId) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { 
      _count: { select: { groupUsers: { where: { isBanned: false } } } },
      competition: { select: { id: true, externalId: true, season: true, name: true, logo: true } },
      messages: {
        take: 50,
        orderBy: { createdAt: 'desc' },
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

  return {
    ...group,
    messages: [...group.messages].reverse(),
    memberCount: group._count.groupUsers,
    isMember: !!membership,
    isAdmin: membership?.isAdmin,
  };
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

  await recalculateAllLeaderboards();
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
    orderBy: [
      { totalPoints: 'desc' },
      { joinedAt: 'asc' },
      { userId: 'asc' },
    ],
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
export async function getMatchPredictions(groupId, externalFixtureId, requestingUserId) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { competition: true },
  });
  if (!group) throw new NotFoundError('Grupo no encontrado');

  const fixture = await getFixtureFromApi(externalFixtureId);
  if (!fixture) throw new NotFoundError('Partido no encontrado en la API');

  const predictionWindow = group.competition
    ? await getFixturePredictionWindow(group.competition, fixture)
    : null;
  const canReveal = canRevealGroupMatchPredictions(fixture, predictionWindow);

  // Obtener los miembros del grupo
  const members = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    select: { userId: true, user: { select: { displayName: true, avatar: true } }, totalPoints: true }
  });

  const visibleMembers = canReveal
    ? members
    : members.filter(m => m.userId === requestingUserId);
  const visibleUserIds = visibleMembers.map(m => m.userId);

  // Traer predicciones para este partido específicas de estos usuarios
  const predictions = await prisma.prediction.findMany({
    where: {
      externalFixtureId,
      userId: { in: visibleUserIds }
    }
  });

  // Mapear combinando predicción e info de usuario, ordenados por puntos de predicción o totalPoints si no hay predi
  const result = visibleMembers.map(m => {
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
 * Recalcula los puntajes del leaderboard de un grupo desde las predicciones globales.
 * NO modifica la tabla Prediction — las predicciones son fuente de verdad global
 * y tocarlas desde acá afectaría a otros grupos donde los mismos usuarios participan.
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

  const members = await prisma.groupUser.findMany({
    where: { groupId, isBanned: false },
    select: { userId: true },
  });

  await recalculateAllLeaderboards();

  console.log(`[Group] ✓ Leaderboard recalculado grupo ${groupId} — ${members.length} miembros`);

  return { predictionsReset: 0, membersReset: members.length };
}

