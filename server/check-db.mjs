import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  try {
    const competitions = await prisma.competition.findMany();
    console.log('COMPETITIONS:', JSON.stringify(competitions, null, 2));

    const groups = await prisma.group.findMany({ take: 5 });
    console.log('GROUPS:', JSON.stringify(groups, null, 2));

    const predictions = await prisma.prediction.findMany({ take: 5 });
    console.log('PREDICTIONS:', JSON.stringify(predictions, null, 2));

    const teams = await prisma.team.findMany({ take: 5 });
    console.log('TEAMS:', JSON.stringify(teams, null, 2));

    const fixtures = await prisma.fixture.findMany({ take: 5 });
    console.log('FIXTURES:', JSON.stringify(fixtures, null, 2));

    const users = await prisma.user.findMany({ take: 3, select: { id: true, email: true, role: true } });
    console.log('USERS:', JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
