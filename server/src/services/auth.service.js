import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

export async function register({ email, username, password, displayName }) {
  const cleanEmail = email.toLowerCase();
  const cleanUsername = username.toLowerCase();
  
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: cleanEmail }, { username: cleanUsername }] },
  });
  if (existing) {
    throw new BadRequestError('El email o nombre de usuario ya existe');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: cleanEmail, username: cleanUsername, password: hashedPassword, displayName: displayName || username },
    select: { id: true, email: true, username: true, displayName: true, role: true },
  });

  const token = generateToken(user);
  return { user, token };
}

export async function login({ login: loginField, password }) {
  const cleanLogin = loginField.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: cleanLogin }, { username: cleanLogin }] },
  });
  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const token = generateToken(user);
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export async function getProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, displayName: true,
      role: true, avatar: true, createdAt: true,
      themeId: true,
      favorites: true,
      _count: { select: { predictions: true, groupUsers: true } },
    },
  });
}

export async function updateProfile(userId, data) {
  return prisma.user.update({
    where: { id: userId },
    data: { 
      displayName: data.displayName, 
      avatar: data.avatar,
      themeId: data.themeId,
    },
    select: { 
      id: true, email: true, username: true, displayName: true, role: true, avatar: true,
      themeId: true,
    },
  });
}

export async function setFavorites(userId, teamNames) {
  // Envolver en transacción para evitar pérdida de datos si createMany falla
  return prisma.$transaction(async (tx) => {
    await tx.favorite.deleteMany({ where: { userId } });
    if (teamNames && teamNames.length > 0) {
      await tx.favorite.createMany({
        data: teamNames.map((teamName) => ({ userId, teamName })),
      });
    }
    return tx.favorite.findMany({ where: { userId } });
  });
}

export async function getFavorites(userId) {
  return prisma.favorite.findMany({ where: { userId } });
}
