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
      themePrimary: true, themeSecondary: true, themeAccent: true,
      themeBgFrom: true, themeBgTo: true,
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
      themePrimary: data.themePrimary,
      themeSecondary: data.themeSecondary,
      themeAccent: data.themeAccent,
      themeBgFrom: data.themeBgFrom,
      themeBgTo: data.themeBgTo
    },
    select: { 
      id: true, email: true, username: true, displayName: true, role: true, avatar: true,
      themePrimary: true, themeSecondary: true, themeAccent: true, themeBgFrom: true, themeBgTo: true
    },
  });
}

export async function setFavorites(userId, teamNames) {
  // Delete existing and recreate
  await prisma.favorite.deleteMany({ where: { userId } });
  if (teamNames && teamNames.length > 0) {
    await prisma.favorite.createMany({
      data: teamNames.map((teamName) => ({ userId, teamName })),
    });
  }
  return prisma.favorite.findMany({ where: { userId } });
}

export async function getFavorites(userId) {
  return prisma.favorite.findMany({ where: { userId } });
}
