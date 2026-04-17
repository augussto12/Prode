/**
 * Wrapper para la API de api-football.com (v3)
 * Cada función hace 1 sola call a la API.
 * Los logos/imágenes NO cuentan contra la cuota.
 */

async function apiCall(endpoint, params = {}) {
  const API_BASE = process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io';
  const API_KEY = process.env.FOOTBALL_API_KEY;

  if (!API_KEY) {
    console.error('FATAL: FOOTBALL_API_KEY is not defined in process.env');
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY || '' },
  });

  if (!res.ok) {
    throw new Error(`API Football error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API Football: ${JSON.stringify(data.errors)}`);
  }

  return {
    results: data.results,
    response: data.response,
    paging: data.paging,
  };
}

// ═══════════════════════════════════════
// STATIC DATA (sync / long cache)
// ═══════════════════════════════════════

/** Obtener equipos de una liga/temporada */
export async function fetchTeams(leagueId, season) {
  return apiCall('teams', { league: leagueId, season });
}

/** Obtener todos los fixtures (partidos) de una liga/temporada */
export async function fetchFixtures(leagueId, season) {
  return apiCall('fixtures', { league: leagueId, season });
}

/** Obtener standings (grupos/tabla) */
export async function fetchStandings(leagueId, season) {
  return apiCall('standings', { league: leagueId, season });
}

/** Obtener plantel de un equipo */
export async function fetchSquad(teamId) {
  return apiCall('players/squads', { team: teamId });
}

// ═══════════════════════════════════════
// EXPLORER DATA (cached via explorer routes)
// ═══════════════════════════════════════

/** Obtener todas las ligas (opcionalmente filtradas por país) */
export async function fetchLeagues(params = {}) {
  // params: { country, season, type, id, search }
  return apiCall('leagues', params);
}

/** Obtener todos los países */
export async function fetchCountries() {
  return apiCall('countries');
}

/** Top goleadores de una liga/temporada */
export async function fetchTopScorers(leagueId, season) {
  return apiCall('players/topscorers', { league: leagueId, season });
}

/** Top asistentes de una liga/temporada */
export async function fetchTopAssists(leagueId, season) {
  return apiCall('players/topassists', { league: leagueId, season });
}

/** Fixtures por fecha (YYYY-MM-DD) */
export async function fetchFixturesByDate(date, leagueId = null, tz = null) {
  const params = { date };
  if (leagueId) params.league = leagueId;
  if (tz) params.timezone = tz;
  return apiCall('fixtures', params);
}

/** Fixtures por ronda */
export async function fetchFixturesByRound(leagueId, season, round) {
  return apiCall('fixtures', { league: leagueId, season, round });
}

/** Head to Head entre dos equipos */
export async function fetchH2H(team1Id, team2Id, last = 10) {
  return apiCall('fixtures/headtohead', { h2h: `${team1Id}-${team2Id}`, last });
}

/** Partidos en vivo — sin cache, datos frescos */
export async function fetchLiveFixtures(leagueIds = null) {
  const live = leagueIds || 'all';
  return apiCall('fixtures', { live });
}

// ═══════════════════════════════════════
// MATCH DETAIL (on-demand)
// ═══════════════════════════════════════

/** Obtener fixture específico por ID */
export async function fetchFixtureById(fixtureId) {
  return apiCall('fixtures', { id: fixtureId });
}

/** Obtener stats de un fixture */
export async function fetchFixtureStats(fixtureId) {
  return apiCall('fixtures/statistics', { fixture: fixtureId });
}

/** Eventos de un fixture */
export async function fetchFixtureEvents(fixtureId) {
  return apiCall('fixtures/events', { fixture: fixtureId });
}

/** Lineups de un fixture */
export async function fetchFixtureLineups(fixtureId) {
  return apiCall('fixtures/lineups', { fixture: fixtureId });
}

// ═══════════════════════════════════════
// PLAYER DATA
// ═══════════════════════════════════════

/** Stats de un jugador en una temporada */
export async function fetchPlayerStats(playerId, season) {
  return apiCall('players', { id: playerId, season });
}

/** Trofeos de un jugador */
export async function fetchPlayerTrophies(playerId) {
  return apiCall('trophies', { player: playerId });
}

/** Transferencias de un jugador */
export async function fetchPlayerTransfers(playerId) {
  return apiCall('transfers', { player: playerId });
}

// ═══════════════════════════════════════
// ODDS
// ═══════════════════════════════════════

/** Odds en vivo */
export async function fetchLiveOdds(fixtureId) {
  return apiCall('odds/live', { fixture: fixtureId });
}

/** Pre-match Odds */
export async function fetchOdds(params) {
  return apiCall('odds', params);
}

// ═══════════════════════════════════════
// STATUS & INJURIES
// ═══════════════════════════════════════

export async function fetchInjuries(params) {
  return apiCall('injuries', params);
}
// ═══════════════════════════════════════

export async function fetchAccountStatus() {
  const API_KEY = process.env.FOOTBALL_API_KEY;
  const API_BASE = process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io';
  
  const res = await fetch(`${API_BASE}/status`, {
    headers: { 'x-apisports-key': API_KEY || '' },
  });
  const data = await res.json();
  return data.response;
}

/** Obtener rondas disponibles de una liga/temporada */
export async function fetchRounds(leagueId, season, { current = false, dates = false } = {}) {
  const params = { league: leagueId, season };
  if (current) params.current = 'true';
  if (dates) params.dates = 'true';
  return apiCall('fixtures/rounds', params);
}

/** Fixture por status */
export async function fetchFixturesByStatus(leagueId, season, status) {
  return apiCall('fixtures', { league: leagueId, season, status });
}

export async function fetchTeamStatistics(leagueId, season, teamId) {
  return apiCall('teams/statistics', { league: leagueId, season, team: teamId });
}

export async function fetchTeamTransfers(teamId) {
  return apiCall('transfers', { team: teamId });
}
