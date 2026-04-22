/**
 * Sportmonks — Servicio de Fixtures y Livescores
 * Endpoints para partidos en vivo, por fecha, por temporada y detalle individual.
 */
import { sportmonksGet, sportmonksGetAll } from './sportmonksClient.js';
import { SPORTMONKS_LEAGUE_IDS } from '../../constants/sportmonks.constants.js';

/**
 * Obtiene todos los partidos en vivo en una sola llamada.
 * Usar includes para traer todo lo necesario sin llamadas extra.
 */
export async function getLiveMatches() {
  return sportmonksGet('/livescores/inplay', {
    include: 'state;scores;participants;periods',
    filters: `fixtureLeagues:${SPORTMONKS_LEAGUE_IDS.join(',')}`,
  });
}

/**
 * Obtiene el endpoint /livescores/latest — solo partidos actualizados recientemente.
 * Más eficiente que /inplay cuando ya tenés los datos base cargados.
 */
export async function getLatestLiveUpdates() {
  return sportmonksGet('/livescores/latest', {
    include: 'participants;scores;events',
    filters: `fixtureLeagues:${SPORTMONKS_LEAGUE_IDS.join(',')}`,
  });
}

/**
 * Fixtures de una fecha específica.
 * @param {string} date - Formato 'YYYY-MM-DD'
 */
export async function getFixturesByDate(date) {
  return sportmonksGet(`/fixtures/date/${date}`, {
    include: 'state;scores;participants;periods',
    filters: `fixtureLeagues:${SPORTMONKS_LEAGUE_IDS.join(',')}`,
    timezone: 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Fixture específico con todos los datos para el detalle del partido.
 * @param {number|string} fixtureId
 */
export async function getFixtureById(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'participants;scores;events;statistics;lineups.details;lineups.player;state;venue;league;season;round;periods',
  });
}

/**
 * Fixture base (solo metadata, score e info general). Lazy loading.
 */
export async function getBaseFixtureById(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'participants;scores;state;venue;league;season;round;periods',
  });
}

/**
 * Lineups de un fixture específico. Lazy loading.
 */
export async function getFixtureLineups(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'lineups.details;lineups.player',
  });
}

/**
 * Events de un fixture específico. Lazy loading.
 */
export async function getFixtureEvents(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'events',
  });
}

/**
 * Statistics de un fixture específico. Lazy loading.
 */
export async function getFixtureStatistics(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'statistics',
  });
}

/**
 * Head To Head history. Lazy loading.
 */
export async function getHeadToHead(team1Id, team2Id) {
  return sportmonksGet(`/fixtures/head-to-head/${team1Id}/${team2Id}`, {
    include: 'participants;scores;state;league',
  });
}

/**
 * Stats finales de un partido terminado — incluye ratings de jugadores.
 * @param {number|string} fixtureId
 */
export async function getFixtureWithPlayerStats(fixtureId) {
  return sportmonksGet(`/fixtures/${fixtureId}`, {
    include: 'lineups.details;lineups.player;statistics;events;scores;participants',
  });
}

/**
 * Fixtures de una temporada completa con paginación manual.
 * Itera todas las páginas de GET /fixtures?filters=fixtureSeason:{seasonId}
 * con pausas entre requests para respetar el rate limit.
 *
 * @param {number|string} seasonId
 * @returns {{ fixtures: Array, pagesProcessed: number }}
 */
export async function getFixturesBySeason(seasonId) {
  const allFixtures = [];
  let currentPage = 1;
  let hasMore = true;
  let pagesProcessed = 0;

  while (hasMore) {
    const data = await sportmonksGet('/fixtures', {
      filters: `seasonIds:${seasonId}`,
      include: 'state;scores;participants;round',
      per_page: 50,
      page: currentPage,
    });

    const fixtures = data?.data || [];
    allFixtures.push(...fixtures);
    pagesProcessed++;

    hasMore = data?.pagination?.has_more || false;
    currentPage++;

    // Pausa entre páginas para no saturar rate limit
    if (hasMore) await new Promise(r => setTimeout(r, 300));
  }

  return { fixtures: allFixtures, pagesProcessed };
}
