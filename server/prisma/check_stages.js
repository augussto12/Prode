import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Ver las stages/rounds que tenemos
  const matches = await prisma.match.findMany({
    select: { stage: true, round: true },
    distinct: ['stage'],
    orderBy: { stage: 'asc' },
  });
  console.log('Stages actuales:');
  matches.forEach(m => console.log(`  stage: "${m.stage}" | round: "${m.round}"`));

  // Ver un sample de fixture de grupo
  const sample = await prisma.match.findFirst({
    where: { round: { contains: 'Group' } },
    select: { homeTeam: true, awayTeam: true, stage: true, round: true },
  });
  console.log('\nSample grupo:', JSON.stringify(sample, null, 2));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
