// Test: ver qué data trae un fixture específico
const API_KEY = '23eac85ce54c183a6aaf21951f1ef7bd';
const BASE = 'https://v3.football.api-sports.io';

// Qatar 0-2 Ecuador (primer partido del mundial 2022, fixture 855736)
const fixtureId = 855736;

async function main() {
  // Events (goles, tarjetas, subs)
  console.log('=== EVENTS ===');
  const evRes = await fetch(`${BASE}/fixtures/events?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const evData = await evRes.json();
  console.log('Total events:', evData.results);
  evData.response?.forEach(e => {
    console.log(`  ${e.time.elapsed}' ${e.team.name} | ${e.type}: ${e.detail} | ${e.player.name}${e.assist?.name ? ' (asist: ' + e.assist.name + ')' : ''}`);
  });

  // Statistics
  console.log('\n=== STATISTICS ===');
  const stRes = await fetch(`${BASE}/fixtures/statistics?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const stData = await stRes.json();
  stData.response?.forEach(team => {
    console.log(`\n  ${team.team.name}:`);
    team.statistics?.forEach(s => {
      console.log(`    ${s.type}: ${s.value}`);
    });
  });
}

main().catch(console.error);
