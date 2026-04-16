import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = '23eac85ce54c183a6aaf21951f1ef7bd';

async function main() {
  // 1 call: traer standings del Mundial 2022
  console.log('Fetching standings from API (1 call)...');
  const res = await fetch(`${API_BASE}/standings?league=1&season=2022`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const data = await res.json();
  
  if (!data.response || data.response.length === 0) {
    console.log('No standings found:', data.errors);
    return;
  }

  // Construir mapa equipo → grupo
  const teamToGroup = new Map();
  const standings = data.response[0].league.standings; // array de arrays (cada sub-array = un grupo)
  
  standings.forEach((group, i) => {
    // El nombre del grupo viene en cada equipo como group
    const groupName = group[0]?.group || `Group ${String.fromCharCode(65 + i)}`;
    // Traducir: "Group A" → "Grupo A"
    const localizedGroup = groupName.replace('Group', 'Grupo');
    
    group.forEach(entry => {
      teamToGroup.set(entry.team.name, localizedGroup);
      console.log(`  ${entry.team.name} → ${localizedGroup}`);
    });
  });

  // Actualizar matches de fase de grupos con el grupo correcto
  const groupMatches = await prisma.match.findMany({
    where: { round: { startsWith: 'Group Stage' } },
  });

  console.log(`\nUpdating ${groupMatches.length} group stage matches...`);
  let updated = 0;

  for (const match of groupMatches) {
    const homeGroup = teamToGroup.get(match.homeTeam);
    const awayGroup = teamToGroup.get(match.awayTeam);
    const group = homeGroup || awayGroup;

    if (group && match.stage !== group) {
      await prisma.match.update({
        where: { id: match.id },
        data: { stage: group },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} matches with correct group names`);

  // Verificar
  const stages = await prisma.match.findMany({
    select: { stage: true },
    distinct: ['stage'],
    orderBy: { stage: 'asc' },
  });
  console.log('\nStages finales:', stages.map(s => s.stage));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
