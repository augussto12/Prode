import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const API_BASE = process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io';
const API_KEY = process.env.FOOTBALL_API_KEY;

async function apiCall(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined) url.searchParams.append(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY },
  });

  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data;
}

async function syncWorldCupTeams() {
  console.log('🌎 Sincronizando equipos del Mundial 2026...');

  const result = await apiCall('/teams', { league: 1, season: 2026 });
  const teams = result.response || [];

  console.log(`   Encontrados ${teams.length} equipos`);

  let created = 0;
  let updated = 0;

  for (const t of teams) {
    const team = t.team;

    const existing = await prisma.team.findFirst({
      where: {
        externalId: Number(team.id),
        source: 'api-football',
      },
    });

    const data = {
      externalId: Number(team.id), // Int en la BD
      name: team.name,
      code: team.code || null,
      logo: team.logo || null,
      country: team.country || null,
      flag: null, // API-Football teams no tienen flag directo
      source: 'api-football',
    };

    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.team.create({ data });
      created++;
    }
  }

  console.log(`   ✅ ${created} creados, ${updated} actualizados`);
  return teams.map(t => ({ id: String(t.team.id), name: t.team.name }));
}

async function syncWorldCupFixtures() {
  console.log('⚽ Sincronizando fixtures del Mundial 2026...');

  // Traer todos los fixtures de la fase de grupos (junio)
  const result = await apiCall('/fixtures', {
    league: 1,
    season: 2026,
    from: '2026-06-01',
    to: '2026-07-20',
  });

  const fixtures = result.response || [];
  console.log(`   Encontrados ${fixtures.length} fixtures`);

  // También traer eliminatorias (julio/agosto)
  const result2 = await apiCall('/fixtures', {
    league: 1,
    season: 2026,
    from: '2026-07-21',
    to: '2026-08-20',
  });
  const fixtures2 = result2.response || [];
  console.log(`   Encontrados ${fixtures2.length} fixtures en fase eliminatoria`);

  const allFixtures = [...fixtures, ...fixtures2];
  console.log(`   Total: ${allFixtures.length} fixtures`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const f of allFixtures) {
    const fixture = f.fixture;
    const teams = f.teams;
    const league = f.league;
    const goals = f.goals;
    const score = f.score;

    // Buscar los equipos locales
    const homeTeam = await prisma.team.findFirst({
      where: { externalId: Number(teams.home.id), source: 'api-football' },
      select: { id: true },
    });

    const awayTeam = await prisma.team.findFirst({
      where: { externalId: Number(teams.away.id), source: 'api-football' },
      select: { id: true },
    });

    if (!homeTeam || !awayTeam) {
      console.log(`   ⚠️ Skip: ${teams.home.name} vs ${teams.away.name} (equipos no encontrados)`);
      skipped++;
      continue;
    }

    const data = {
      externalId: String(fixture.id),
      source: 'api-football',
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      startTime: new Date(fixture.date),
      status: mapStatus(fixture.status?.short),
      homeScore: goals.home ?? null,
      awayScore: goals.away ?? null,
      round: league.round || null,
      venueName: fixture.venue?.name || null,
      leagueId: Number(league.id),
      seasonId: Number(league.season),
      isLive: ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(fixture.status?.short),
    };

    const existing = await prisma.fixture.findFirst({
      where: {
        externalId: String(fixture.id),
        source: 'api-football',
      },
    });

    if (existing) {
      await prisma.fixture.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.fixture.create({ data });
      created++;
    }
  }

  console.log(`   ✅ ${created} creados, ${updated} actualizados, ${skipped} skipped`);
}

function mapStatus(apiStatus) {
  const map = {
    'NS': 'scheduled',
    'TBD': 'scheduled',
    '1H': 'live',
    'HT': 'live',
    '2H': 'live',
    'ET': 'live',
    'BT': 'live',
    'P': 'live',
    'FT': 'finished',
    'AET': 'finished',
    'PEN': 'finished',
    'SUSP': 'postponed',
    'INT': 'interrupted',
    'CANC': 'cancelled',
    'ABD': 'abandoned',
    'AWD': 'finished',
    'WO': 'finished',
  };
  return map[apiStatus] || apiStatus?.toLowerCase() || 'scheduled';
}

async function verifySync() {
  console.log('\n📊 Verificación:');
  const teamCount = await prisma.team.count({ where: { source: 'api-football' } });
  const fixtureCount = await prisma.fixture.count({ where: { source: 'api-football' } });
  const wcFixtures = await prisma.fixture.count({
    where: { source: 'api-football', seasonId: 2026 },
  });

  console.log(`   Equipos api-football: ${teamCount}`);
  console.log(`   Fixtures api-football: ${fixtureCount}`);
  console.log(`   Fixtures Mundial 2026: ${wcFixtures}`);
}

async function main() {
  console.log('🏆 SINCRONIZACIÓN MUNDIAL 2026\n');

  try {
    await syncWorldCupTeams();
    await syncWorldCupFixtures();
    await verifySync();
    console.log('\n✅ Sincronización completada!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
