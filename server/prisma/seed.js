import pkg from '@prisma/client';
import bcrypt from 'bcrypt';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      exactScore: 10,
      correctWinner: 3,
      doubleChance: 0,
      btts: 0,
      overUnder: 0,
      moreShots: 0,
      moreCorners: 0,
      morePossession: 0,
      moreFouls: 0,
      moreCards: 0,
      moreOffsides: 0,
      moreSaves: 0,
    },
  });
  console.log('ScoringConfig ready.');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@prode.com' },
    update: { emailVerifiedAt: new Date() },
    create: {
      email: 'admin@prode.com',
      username: 'superadmin',
      password: hashedPassword,
      displayName: 'System Admin',
      role: 'SUPERADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Superadmin ready.');

  const competition = await prisma.competition.upsert({
    where: { externalId_season: { externalId: 1, season: 2026 } },
    update: {},
    create: {
      externalId: 1,
      name: 'Copa del Mundo 2026',
      logo: 'https://media.api-sports.io/football/leagues/1.png',
      season: 2026,
    },
  });
  console.log(`Competition ready: ${competition.name}`);

  const group = await prisma.group.upsert({
    where: { inviteCode: '756d0137-c1be-4039-b8d1-6112739db2ea' },
    update: {
      competitionId: competition.id,
      createdById: admin.id,
    },
    create: {
      name: 'Prode Mundial Global',
      description: 'El grupo oficial de la plataforma. Todos son bienvenidos.',
      inviteCode: '756d0137-c1be-4039-b8d1-6112739db2ea',
      isPublic: true,
      createdById: admin.id,
      competitionId: competition.id,
    },
  });

  await prisma.groupUser.upsert({
    where: { userId_groupId: { userId: admin.id, groupId: group.id } },
    update: { isAdmin: true, isBanned: false, bannedAt: null },
    create: { userId: admin.id, groupId: group.id, isAdmin: true },
  });
  console.log('Public group ready.');

  console.log('Seed finished successfully.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
