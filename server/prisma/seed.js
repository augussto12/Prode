import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Crear ScoringConfig global
  await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      exactScore: 10,
      correctWinner: 3,
      doubleChance: 1,
      btts: 2,
      overUnder: 2,
      moreShots: 2,
      moreCorners: 2,
    },
  });
  console.log('✅ Global ScoringConfig created.');

  // 2. Crear SuperAdmin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@prode.com' },
    update: {},
    create: {
      email: 'admin@prode.com',
      username: 'superadmin',
      password: hashedPassword,
      displayName: 'System Admin',
      role: 'SUPERADMIN',
    },
  });
  console.log('✅ Superadmin created.');

  // 3. Crear Competition de ejemplo (Mundial 2026)
  const competition = await prisma.competition.upsert({
    where: { externalId_season: { externalId: 1, season: 2026 } },
    update: {},
    create: {
      externalId: 1,
      name: 'Copa del Mundo 2026',
      logo: null,
      season: 2026,
    },
  });
  console.log('✅ Competition created:', competition.name);

  // 4. Crear Partidos del Mundial 2026 (Fase de Grupos - simulados)
  const now = Date.now();
  const DAY = 86400000;
  const matchesData = [
    // Grupo A
    { homeTeam: 'Argentina', homeFlag: '🇦🇷', awayTeam: 'Arabia Saudita', awayFlag: '🇸🇦', matchDate: new Date(now + DAY * 1), stage: 'Grupo A', venue: 'MetLife Stadium, New York', competitionId: competition.id },
    { homeTeam: 'México', homeFlag: '🇲🇽', awayTeam: 'Polonia', awayFlag: '🇵🇱', matchDate: new Date(now + DAY * 1), stage: 'Grupo A', venue: 'Estadio Azteca, CDMX', competitionId: competition.id },
    { homeTeam: 'Argentina', homeFlag: '🇦🇷', awayTeam: 'México', awayFlag: '🇲🇽', matchDate: new Date(now + DAY * 5), stage: 'Grupo A', venue: 'AT&T Stadium, Dallas', competitionId: competition.id },
    { homeTeam: 'Polonia', homeFlag: '🇵🇱', awayTeam: 'Arabia Saudita', awayFlag: '🇸🇦', matchDate: new Date(now + DAY * 5), stage: 'Grupo A', venue: 'BMO Stadium, Toronto', competitionId: competition.id },
    // Grupo B
    { homeTeam: 'Brasil', homeFlag: '🇧🇷', awayTeam: 'Serbia', awayFlag: '🇷🇸', matchDate: new Date(now + DAY * 2), stage: 'Grupo B', venue: 'SoFi Stadium, LA', competitionId: competition.id },
    { homeTeam: 'Suiza', homeFlag: '🇨🇭', awayTeam: 'Camerún', awayFlag: '🇨🇲', matchDate: new Date(now + DAY * 2), stage: 'Grupo B', venue: 'BC Place, Vancouver', competitionId: competition.id },
    // Grupo C
    { homeTeam: 'España', homeFlag: '🇪🇸', awayTeam: 'Alemania', awayFlag: '🇩🇪', matchDate: new Date(now + DAY * 3), stage: 'Grupo C', venue: 'Rose Bowl, LA', competitionId: competition.id },
    { homeTeam: 'Japón', homeFlag: '🇯🇵', awayTeam: 'Costa Rica', awayFlag: '🇨🇷', matchDate: new Date(now + DAY * 3), stage: 'Grupo C', venue: 'Lumen Field, Seattle', competitionId: competition.id },
    // Grupo D
    { homeTeam: 'Francia', homeFlag: '🇫🇷', awayTeam: 'Inglaterra', awayFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', matchDate: new Date(now + DAY * 4), stage: 'Grupo D', venue: 'MetLife Stadium, New York', competitionId: competition.id },
    { homeTeam: 'Uruguay', homeFlag: '🇺🇾', awayTeam: 'Colombia', awayFlag: '🇨🇴', matchDate: new Date(now + DAY * 4), stage: 'Grupo D', venue: 'Hard Rock Stadium, Miami', competitionId: competition.id },
    // Grupo E
    { homeTeam: 'Portugal', homeFlag: '🇵🇹', awayTeam: 'Países Bajos', awayFlag: '🇳🇱', matchDate: new Date(now + DAY * 6), stage: 'Grupo E', venue: 'Gillette Stadium, Boston', competitionId: competition.id },
    { homeTeam: 'Italia', homeFlag: '🇮🇹', awayTeam: 'Croacia', awayFlag: '🇭🇷', matchDate: new Date(now + DAY * 6), stage: 'Grupo E', venue: 'Lincoln Financial, Philly', competitionId: competition.id },
  ];

  for (const match of matchesData) {
    const exists = await prisma.match.findFirst({
      where: { homeTeam: match.homeTeam, awayTeam: match.awayTeam, stage: match.stage },
    });
    if (!exists) {
      await prisma.match.create({ data: match });
    }
  }
  console.log(`✅ ${matchesData.length} matches created.`);

  // 5. Crear Grupo público de ejemplo (vinculado a la competencia)
  const existingGroup = await prisma.group.findFirst({ where: { name: 'Prode Mundial Global' } });
  if (!existingGroup) {
    const group = await prisma.group.create({
      data: {
        name: 'Prode Mundial Global',
        description: 'El grupo oficial de la plataforma. ¡Todos son bienvenidos!',
        isPublic: true,
        createdById: admin.id,
        competitionId: competition.id,
        primaryColor: '#0ea5e9',
        secondaryColor: '#3b82f6',
        accentColor: '#fbbf24',
        bgGradientFrom: '#082f49',
        bgGradientTo: '#172554',
      },
    });

    // Admin se une a su propio grupo
    await prisma.groupUser.create({
      data: { userId: admin.id, groupId: group.id, isAdmin: true },
    });
  }
  console.log('✅ Public group created.');

  console.log('🎉 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
