import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const old = await prisma.match.count({ where: { externalId: null } });
  const api = await prisma.match.count({ where: { externalId: { not: null } } });
  console.log(`Old mock matches: ${old}`);
  console.log(`API matches: ${api}`);

  if (old > 0) {
    // Primero borrar predictions asociadas a partidos mock
    const oldMatches = await prisma.match.findMany({ where: { externalId: null }, select: { id: true } });
    const oldIds = oldMatches.map(m => m.id);
    
    const deletedPreds = await prisma.prediction.deleteMany({ where: { matchId: { in: oldIds } } });
    console.log(`Deleted ${deletedPreds.count} predictions from old matches`);
    
    const deleted = await prisma.match.deleteMany({ where: { externalId: null } });
    console.log(`Deleted ${deleted.count} old mock matches`);
  }

  const remaining = await prisma.match.count();
  console.log(`Remaining matches: ${remaining}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
