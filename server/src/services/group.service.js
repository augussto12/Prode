import prisma from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import crypto from 'crypto';

export async function createGroup(userId, data) {
  const group = await prisma.group.create({
    data: {
      name: data.name,
      description: data.description,
      isPublic: data.isPublic || false,
      createdById: userId,
      primaryColor: data.primaryColor || '#6366f1',
      secondaryColor: data.secondaryColor || '#8b5cf6',
      accentColor: data.accentColor || '#f59e0b',
      bgGradientFrom: data.bgGradientFrom || '#0f172a',
      bgGradientTo: data.bgGradientTo || '#1e1b4b',
    },
  });

  // Creator joins as admin
  await prisma.groupUser.create({
    data: { userId, groupId: group.id, isAdmin: true },
  });

  return group;
}

export async function getMyGroups(userId) {
  const memberships = await prisma.groupUser.findMany({
    where: { userId, isBanned: false },
    include: {
      group: {
        include: { _count: { select: { groupUsers: { where: { isBanned: false } } } } },
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
      messages: {
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, displayName: true, role: true, themePrimary: true } }
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

  await prisma.groupUser.create({
    data: { userId, groupId: group.id },
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

  return prisma.group.update({
    where: { id: groupId },
    data: {
      primaryColor: themeData.primaryColor,
      secondaryColor: themeData.secondaryColor,
      accentColor: themeData.accentColor,
      bgGradientFrom: themeData.bgGradientFrom,
      bgGradientTo: themeData.bgGradientTo,
    },
  });
}

export async function getPublicGroups() {
  return prisma.group.findMany({
    where: { isPublic: true },
    include: { _count: { select: { groupUsers: { where: { isBanned: false } } } } },
    orderBy: { createdAt: 'desc' },
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
