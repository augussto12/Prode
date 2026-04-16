import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: { exactScore: 5, correctWinner: 2, moreShots: 1, moreCorners: 1, doubleChance: 0, btts: 0, overUnder: 0 },
    create: { exactScore: 5, correctWinner: 2, moreShots: 1, moreCorners: 1, doubleChance: 0, btts: 0, overUnder: 0 }
  });
  console.log('Seed applied');
}
run().finally(() => prisma.$disconnect());
