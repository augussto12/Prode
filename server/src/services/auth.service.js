import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import prisma from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './email.service.js';

const VERIFICATION_TOKEN_HOURS = 24;
const PASSWORD_RESET_TOKEN_HOURS = 1;

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  avatar: true,
  themeId: true,
  emailVerifiedAt: true,
};

function createRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function expiresInHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function createDevUrl(path, token) {
  if (process.env.NODE_ENV === 'production') return null;
  return `${getFrontendUrl()}${path}?token=${encodeURIComponent(token)}`;
}

async function createEmailVerificationToken(userId) {
  const rawToken = createRawToken();
  await prisma.emailVerificationToken.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: expiresInHours(VERIFICATION_TOKEN_HOURS),
    },
  });
  return rawToken;
}

async function createPasswordResetToken(userId) {
  const rawToken = createRawToken();
  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: expiresInHours(PASSWORD_RESET_TOKEN_HOURS),
    },
  });
  return rawToken;
}

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
    data: {
      email: cleanEmail,
      username: cleanUsername,
      password: hashedPassword,
      displayName: displayName || username,
      emailVerifiedAt: null,
    },
    select: publicUserSelect,
  });

  const verificationToken = await createEmailVerificationToken(user.id);
  let delivery;
  try {
    delivery = await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      token: verificationToken,
    });
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    throw err;
  }

  const result = {
    user,
    message: 'Cuenta creada. Revisa tu email para verificarla antes de ingresar.',
  };

  if (delivery?.skipped) {
    result.devVerificationUrl = createDevUrl('/verify-email', verificationToken);
  }

  return result;
}

export async function login({ login: loginField, password }) {
  const cleanLogin = loginField.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: cleanLogin }, { username: cleanLogin }] },
  });
  if (!user) {
    throw new UnauthorizedError('Credenciales invalidas');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new UnauthorizedError('Credenciales invalidas');
  }

  if (!user.emailVerifiedAt) {
    throw new UnauthorizedError('Tenes que verificar tu email antes de ingresar');
  }

  const token = generateToken(user);
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export async function verifyEmail(token) {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new BadRequestError('El link de verificacion es invalido o ya vencio');
  }

  const user = await prisma.$transaction(async (tx) => {
    const tokenUpdate = await tx.emailVerificationToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (tokenUpdate.count !== 1) {
      throw new BadRequestError('El link de verificacion es invalido o ya vencio');
    }

    return tx.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: record.user.emailVerifiedAt || new Date(),
      },
      select: publicUserSelect,
    });
  });

  const authToken = generateToken(user);
  return { user, token: authToken, message: 'Email verificado correctamente.' };
}

export async function resendVerification({ email }) {
  const cleanEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  if (user && !user.emailVerifiedAt) {
    const verificationToken = await createEmailVerificationToken(user.id);
    const delivery = await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      token: verificationToken,
    });
    const result = { message: 'Si el email existe y esta pendiente, te enviamos un nuevo link.' };
    if (delivery?.skipped) {
      result.devVerificationUrl = createDevUrl('/verify-email', verificationToken);
    }
    return result;
  }

  return { message: 'Si el email existe y esta pendiente, te enviamos un nuevo link.' };
}

export async function forgotPassword({ email }) {
  const cleanEmail = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  if (user) {
    const resetToken = await createPasswordResetToken(user.id);
    const delivery = await sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      token: resetToken,
    });
    const result = { message: 'Si el email existe, te enviamos un link para restablecer la contrasena.' };
    if (delivery?.skipped) {
      result.devResetUrl = createDevUrl('/reset-password', resetToken);
    }
    return result;
  }

  return { message: 'Si el email existe, te enviamos un link para restablecer la contrasena.' };
}

export async function resetPassword({ token, password }) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new BadRequestError('El link para restablecer la contrasena es invalido o ya vencio');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const tokenUpdate = await tx.passwordResetToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (tokenUpdate.count !== 1) {
      throw new BadRequestError('El link para restablecer la contrasena es invalido o ya vencio');
    }

    await tx.user.update({
      where: { id: record.userId },
      data: {
        password: hashedPassword,
        emailVerifiedAt: record.user.emailVerifiedAt || new Date(),
      },
    });
  });

  return { message: 'Contrasena actualizada. Ya podes ingresar.' };
}

export async function getProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      role: true,
      avatar: true,
      createdAt: true,
      emailVerifiedAt: true,
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
    select: publicUserSelect,
  });
}

export async function setFavorites(userId, teamNames) {
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

export async function getLeagueFavorites(userId) {
  return prisma.leagueFavorite.findMany({ where: { userId } });
}

export async function addLeagueFavorite(userId, leagueId) {
  return prisma.leagueFavorite.upsert({
    where: { userId_leagueId: { userId, leagueId } },
    update: {},
    create: { userId, leagueId },
  });
}

export async function removeLeagueFavorite(userId, leagueId) {
  return prisma.leagueFavorite.deleteMany({
    where: { userId, leagueId },
  });
}
