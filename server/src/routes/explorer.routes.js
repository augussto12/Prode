/**
 * Explorer Routes — Proxy con cache para API-Football
 * Toda la data del explorador pasa por acá.
 * El frontend NUNCA habla directo con api-football.com.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as footballApi from '../services/football-api.service.js';
import { cachedApiCall, getCacheStats } from '../services/cache.service.js';
import { TOP_LEAGUE_IDS, CURATED_LEAGUES, ALLOWED_LEAGUE_IDS, LIVE_LEAGUE_IDS_STRING } from '../config/leagues.config.js';

const router = Router();

// Current season helper — default to current year
function getCurrentSeason() {
  return new Date().getFullYear();
}

// ═══════════════════════════════════════
// LEAGUES & COUNTRIES
// ═══════════════════════════════════════

/** GET /api/explorer/leagues — Todas las ligas agrupadas */
router.get('/leagues', async (req, res, next) => {
  try {
    const { country, season, type, search } = req.query;
    const cacheKey = `leagues:${country || 'all'}:${season || ''}:${type || ''}:${search || ''}`;

    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const params = {};
      if (country) params.country = country;
      if (season) params.season = Number(season);
      if (type) params.type = type;
      if (search) params.search = search;
      const result = await footballApi.fetchLeagues(params);
      return result.response;
    });

    // Filtrar solo ligas curadas
    const filtered = data.filter(l => ALLOWED_LEAGUE_IDS.has(l.league.id));

    // Separar en Top y resto, ordenar
    const topLeagues = [];
    const otherLeagues = [];

    for (const league of filtered) {
      if (TOP_LEAGUE_IDS.includes(league.league.id)) {
        topLeagues.push(league);
      } else {
        otherLeagues.push(league);
      }
    }

    // Ordenar top según el array de IDs
    topLeagues.sort((a, b) =>
      TOP_LEAGUE_IDS.indexOf(a.league.id) - TOP_LEAGUE_IDS.indexOf(b.league.id)
    );

    // Agrupar por país (usando la config de categorías) — incluye TODAS las ligas, incluso las top
    const byCategory = {};
    for (const [categoryName, ids] of Object.entries(CURATED_LEAGUES)) {
      if (categoryName === 'Torneos Internacionales') continue; // ya están en top
      const categoryLeagues = filtered.filter(l => ids.includes(l.league.id));
      if (categoryLeagues.length > 0) {
        byCategory[categoryName] = categoryLeagues;
      }
    }

    const countries = Object.entries(byCategory)
      .map(([name, leagues]) => ({
        country: name,
        flag: leagues[0]?.country?.flag || null,
        leagues: leagues.sort((a, b) => a.league.name.localeCompare(b.league.name)),
      }));

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ topLeagues, byCountry: countries });
  } catch (err) { next(err); }
});

/** GET /api/explorer/countries — Lista de países */
router.get('/countries', async (req, res, next) => {
  try {
    const data = await cachedApiCall('countries', 604800, async () => {
      const result = await footballApi.fetchCountries();
      return result.response;
    });
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// LEAGUE DETAIL
// ═══════════════════════════════════════

/** GET /api/explorer/leagues/:id — Info detallada de una liga */
router.get('/leagues/:id', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `league-detail:${leagueId}:${season}`;

    const data = await cachedApiCall(cacheKey, 7200, async () => {
      const result = await footballApi.fetchLeagues({ id: leagueId });
      return result.response?.[0] || null;
    });

    res.set('Cache-Control', 'public, max-age=7200');
    res.json({ ...data, currentSeason: season });
  } catch (err) { next(err); }
});

/** GET /api/explorer/leagues/:id/standings — Tabla de posiciones */
router.get('/leagues/:id/standings', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `standings:${leagueId}:${season}`;

    const data = await cachedApiCall(cacheKey, 7200, async () => {
      const result = await footballApi.fetchStandings(leagueId, season);
      return result.response?.[0] || null;
    });

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/leagues/:id/fixtures — Fixtures de la liga */
router.get('/leagues/:id/fixtures', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const round = req.query.round || null;
    const cacheKey = `fixtures:${leagueId}:${season}:${round || 'all'}`;

    const data = await cachedApiCall(cacheKey, 3600, async () => {
      if (round) {
        const result = await footballApi.fetchFixturesByRound(leagueId, season, round);
        return result.response;
      }
      const result = await footballApi.fetchFixtures(leagueId, season);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/leagues/:id/rounds — Rondas disponibles */
router.get('/leagues/:id/rounds', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `rounds:${leagueId}:${season}`;

    const data = await cachedApiCall(cacheKey, 3600, async () => {
      const result = await footballApi.fetchRounds(leagueId, season);
      return result.response;
    });

    // Also fetch current round
    const currentRound = await cachedApiCall(`current-round:${leagueId}:${season}`, 3600, async () => {
      const result = await footballApi.fetchRounds(leagueId, season, { current: true });
      return result.response?.[0] || null;
    });

    res.json({ rounds: data, currentRound });
  } catch (err) { next(err); }
});

/** GET /api/explorer/leagues/:id/scorers — Top goleadores */
router.get('/leagues/:id/scorers', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `scorers:${leagueId}:${season}`;

    const data = await cachedApiCall(cacheKey, 21600, async () => {
      const result = await footballApi.fetchTopScorers(leagueId, season);
      return result.response;
    });

    res.set('Cache-Control', 'public, max-age=21600');
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/leagues/:id/assists — Top asistentes */
router.get('/leagues/:id/assists', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `assists:${leagueId}:${season}`;

    const data = await cachedApiCall(cacheKey, 21600, async () => {
      const result = await footballApi.fetchTopAssists(leagueId, season);
      return result.response;
    });

    res.set('Cache-Control', 'public, max-age=21600');
    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// LIVE & FIXTURES
// ═══════════════════════════════════════

/** GET /api/explorer/live — Partidos en vivo (SIN CACHE), solo ligas curadas, agrupados por liga */
router.get('/live', async (req, res, next) => {
  try {
    const result = await footballApi.fetchLiveFixtures(LIVE_LEAGUE_IDS_STRING);
    const matches = result.response || [];

    // Filtrar solo ligas curadas (doble check)
    const filtered = matches.filter(m => ALLOWED_LEAGUE_IDS.has(m.league?.id));

    // Agrupar por liga
    const byLeague = {};
    filtered.forEach(m => {
      const key = m.league?.id;
      if (!byLeague[key]) {
        byLeague[key] = {
          league: m.league,
          matches: [],
        };
      }
      byLeague[key].matches.push(m);
    });

    const grouped = Object.values(byLeague).sort((a, b) => {
      // Top leagues first
      const aTop = TOP_LEAGUE_IDS.indexOf(a.league.id);
      const bTop = TOP_LEAGUE_IDS.indexOf(b.league.id);
      if (aTop !== -1 && bTop !== -1) return aTop - bTop;
      if (aTop !== -1) return -1;
      if (bTop !== -1) return 1;
      return a.league.name.localeCompare(b.league.name);
    });

    res.json({ total: filtered.length, grouped });
  } catch (err) { next(err); }
});

/** GET /api/explorer/today — Partidos del día de hoy, agrupados por liga */
router.get('/today', async (req, res, next) => {
  try {
    const tz = req.query.timezone || 'America/Argentina/Buenos_Aires';
    // Format date in the requested timezone (en-CA naturally outputs YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const cacheKey = `today-matches:${todayStr}:${tz}`;

    const data = await cachedApiCall(cacheKey, 600, async () => {
      const result = await footballApi.fetchFixturesByDate(todayStr, null, tz);
      return result.response;
    });

    const filtered = (data || []).filter(m => ALLOWED_LEAGUE_IDS.has(m.league?.id));

    const byLeague = {};
    filtered.forEach(m => {
      const key = m.league?.id;
      if (!byLeague[key]) {
        byLeague[key] = {
          league: m.league,
          matches: [],
        };
      }
      byLeague[key].matches.push(m);
    });

    const grouped = Object.values(byLeague).sort((a, b) => {
      const aTop = TOP_LEAGUE_IDS.indexOf(a.league.id);
      const bTop = TOP_LEAGUE_IDS.indexOf(b.league.id);
      if (aTop !== -1 && bTop !== -1) return aTop - bTop;
      if (aTop !== -1) return -1;
      if (bTop !== -1) return 1;
      return a.league.name.localeCompare(b.league.name);
    });

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ total: filtered.length, grouped });
  } catch (err) { next(err); }
});

/** GET /api/explorer/fixtures/date/:date — Partidos por fecha */
router.get('/fixtures/date/:date', async (req, res, next) => {
  try {
    const date = req.params.date; // YYYY-MM-DD
    const leagueId = req.query.league ? Number(req.query.league) : null;
    const cacheKey = `fixtures-date:${date}:${leagueId || 'all'}`;

    const data = await cachedApiCall(cacheKey, 3600, async () => {
      const result = await footballApi.fetchFixturesByDate(date, leagueId);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/fixtures/:id — Detalle de un partido */
router.get('/fixtures/:id', async (req, res, next) => {
  try {
    const fixtureId = Number(req.params.id);
    const cacheKey = `fixture:${fixtureId}`;

    // Si está en vivo, cache corto de 30s; si terminó, 1 hora
    const data = await cachedApiCall(cacheKey, 30, async () => {
      const [fixtureRes, eventsRes, statsRes, lineupsRes] = await Promise.all([
        footballApi.fetchFixtureById(fixtureId),
        footballApi.fetchFixtureEvents(fixtureId).catch(() => ({ response: [] })),
        footballApi.fetchFixtureStats(fixtureId).catch(() => ({ response: [] })),
        footballApi.fetchFixtureLineups(fixtureId).catch(() => ({ response: [] })),
      ]);

      return {
        fixture: fixtureRes.response?.[0] || null,
        events: eventsRes.response || [],
        statistics: statsRes.response || [],
        lineups: lineupsRes.response || [],
      };
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/fixtures/:id/lineups — Lineups */
router.get('/fixtures/:id/lineups', async (req, res, next) => {
  try {
    const fixtureId = Number(req.params.id);
    const cacheKey = `lineups:${fixtureId}`;

    const data = await cachedApiCall(cacheKey, 3600, async () => {
      const result = await footballApi.fetchFixtureLineups(fixtureId);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// PLAYER
// ═══════════════════════════════════════

/** GET /api/explorer/players/:id — Perfil completo de jugador */
router.get('/players/:id', async (req, res, next) => {
  try {
    const playerId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const cacheKey = `player:${playerId}:${season}`;

    const data = await cachedApiCall(cacheKey, 21600, async () => {
      const [statsRes, trophiesRes, transfersRes] = await Promise.all([
        footballApi.fetchPlayerStats(playerId, season),
        footballApi.fetchPlayerTrophies(playerId).catch(() => ({ response: [] })),
        footballApi.fetchPlayerTransfers(playerId).catch(() => ({ response: [] })),
      ]);

      return {
        stats: statsRes.response?.[0] || null,
        trophies: trophiesRes.response || [],
        transfers: transfersRes.response?.[0]?.transfers || [],
      };
    });

    res.set('Cache-Control', 'public, max-age=21600');
    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// HEAD TO HEAD
// ═══════════════════════════════════════

/** GET /api/explorer/h2h/:team1/:team2 — Historial entre dos equipos */
router.get('/h2h/:team1/:team2', async (req, res, next) => {
  try {
    const team1 = Number(req.params.team1);
    const team2 = Number(req.params.team2);
    const last = Number(req.query.last) || 10;
    const cacheKey = `h2h:${team1}:${team2}:${last}`;

    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await footballApi.fetchH2H(team1, team2, last);
      return result.response;
    });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// INJURIES
// ═══════════════════════════════════════

/** GET /api/explorer/injuries — Lesionados/Suspendidos */
router.get('/injuries', async (req, res, next) => {
  try {
    const { fixture, league, season, team } = req.query;
    // Cache for 4 hours (14400s) as API updates every 4 hours
    const cacheKey = `injuries:${fixture || ''}:${league || ''}:${season || ''}:${team || ''}`;

    const data = await cachedApiCall(cacheKey, 14400, async () => {
      const params = {};
      if (fixture) params.fixture = fixture;
      if (league) params.league = league;
      if (season) params.season = season;
      if (team) params.team = team;
      const result = await footballApi.fetchInjuries(params);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// LIVE ODDS
// ═══════════════════════════════════════

/** GET /api/explorer/odds/live/:fixture — Cuotas en vivo del partido */
router.get('/odds/live/:fixture', async (req, res, next) => {
  try {
    const fixtureId = Number(req.params.fixture);
    // Cache very short (15 seconds) to prevent spamming while keeping it fresh
    const cacheKey = `odds:live:${fixtureId}`;

    const data = await cachedApiCall(cacheKey, 15, async () => {
      const result = await footballApi.fetchLiveOdds(fixtureId);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/odds — Cuotas pre-partido */
router.get('/odds', async (req, res, next) => {
  try {
    const { fixture, league, season, date } = req.query;
    // Cache for 3 hours (10800s) as API updates every 3 hours
    const cacheKey = `odds:pre:${fixture || ''}:${league || ''}:${season || ''}:${date || ''}`;

    const data = await cachedApiCall(cacheKey, 10800, async () => {
      const params = {};
      if (fixture) params.fixture = fixture;
      if (league) params.league = league;
      if (season) params.season = season;
      if (date) params.date = date;
      const result = await footballApi.fetchOdds(params);
      return result.response;
    });

    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════

/** GET /api/explorer/teams/:id — Información básica del equipo */
router.get('/teams/:id', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const cacheKey = `team:info:${teamId}`;
    
    // Cache for 24 hours (86400s)
    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await footballApi.fetchTeams(null, null).catch(async () => {
         // footballApi.fetchTeams expects league/season, but there is an endpoint for just team ID
         // Let's implement team info via apiCall('teams', { id: teamId })
         const url = `${process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io'}/teams?id=${teamId}`;
         const r = await fetch(url, { headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY } });
         return r.json();
      });
      return result.response?.[0] || null;
    });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/teams/:id/squad — Plantilla del equipo */
router.get('/teams/:id/squad', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const cacheKey = `team:squad:${teamId}`;
    
    // Cache for 24 hours (86400s)
    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await footballApi.fetchSquad(teamId);
      return result.response?.[0]?.players || [];
    });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/teams/:id/coach — Técnico del equipo */
router.get('/teams/:id/coach', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const cacheKey = `team:coach:${teamId}`;
    
    // Cache for 24 hours
    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const url = `${process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io'}/coachs?team=${teamId}`;
      const r = await fetch(url, { headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY } });
      const result = await r.json();
      return result.response || [];
    });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/teams/:id/fixtures — Partidos del equipo */
router.get('/teams/:id/fixtures', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const currentYear = getCurrentSeason();
    const prevYear = currentYear - 1;
    const cacheKey = `team:fixtures:${teamId}:${prevYear}-${currentYear}`;
    
    // Cache for 1 hour (3600s) — fixtures change frequently during active seasons
    const data = await cachedApiCall(cacheKey, 3600, async () => {
      const baseUrl = `${process.env.FOOTBALL_API_BASE || 'https://v3.football.api-sports.io'}/fixtures`;
      const headers = { 'x-apisports-key': process.env.FOOTBALL_API_KEY };
      
      // Fetch both seasons in parallel — European leagues use prev year (e.g., 2025 for 2025-2026)
      const [currentRes, prevRes] = await Promise.all([
        fetch(`${baseUrl}?team=${teamId}&season=${currentYear}`, { headers }).then(r => r.json()).catch(() => ({ response: [] })),
        fetch(`${baseUrl}?team=${teamId}&season=${prevYear}`, { headers }).then(r => r.json()).catch(() => ({ response: [] })),
      ]);

      // Merge and deduplicate by fixture ID
      const all = [...(currentRes.response || []), ...(prevRes.response || [])];
      const seen = new Set();
      return all.filter(f => {
        const fId = f.fixture?.id;
        if (seen.has(fId)) return false;
        seen.add(fId);
        return true;
      });
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/teams/:id/statistics — Estadísticas del equipo */
router.get('/teams/:id/statistics', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const season = Number(req.query.season) || getCurrentSeason();
    const leagueId = Number(req.query.league);
    
    if (!leagueId) return res.status(400).json({ error: 'league query parameter required' });

    const cacheKey = `team:stats:${teamId}:${leagueId}:${season}`;
    
    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await footballApi.fetchTeamStatistics(leagueId, season, teamId);
      return result.response || null;
    });

    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/explorer/teams/:id/transfers — Fichajes del equipo */
router.get('/teams/:id/transfers', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const cacheKey = `team:transfers:${teamId}`;
    
    // Cache for 24 hours (86400s) since transfers don't change that rapidly outside of windows
    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await footballApi.fetchTeamTransfers(teamId);
      return result.response || [];
    });

    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// CACHE STATUS (admin)
// ═══════════════════════════════════════

router.get('/cache/stats', authenticate, async (req, res) => {
  // Solo admins pueden ver stats del cache
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  res.json(getCacheStats());
});

export default router;
