import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'prode-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [groupJoinPolicy] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Group'
          AND column_name = 'joinPolicy'
      ) AS "exists"
    `;

    const [groupInvite] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'GroupInvite'
      ) AS "exists"
    `;

    const [emailVerifiedAt] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'User'
          AND column_name = 'emailVerifiedAt'
      ) AS "exists"
    `;

    const [emailVerificationToken] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'EmailVerificationToken'
      ) AS "exists"
    `;

    const [passwordResetToken] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'PasswordResetToken'
      ) AS "exists"
    `;

    const checks = {
      database: true,
      groupJoinPolicy: Boolean(groupJoinPolicy?.exists),
      groupInvite: Boolean(groupInvite?.exists),
      emailVerifiedAt: Boolean(emailVerifiedAt?.exists),
      emailVerificationToken: Boolean(emailVerificationToken?.exists),
      passwordResetToken: Boolean(passwordResetToken?.exists),
    };
    const ready = Object.values(checks).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
