/**
 * Sportmonks API Routes
 * Endpoints para consumir datos de Sportmonks desde la BD local.
 * Estrategia: BD primero → fallback a API si datos viejos/inexistentes → guardar y devolver.
 *
 * Todos bajo /api/sportmonks
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { cachedApiCall } from '../services/cache.service.js';
import * as smFixtures from '../services/sportmonks/sportmonksFixtures.js';
import * as smPlayers from '../services/sportmonks/sportmonksPlayers.js';
import * as smTeams from '../services/sportmonks/sportmonksTeams.js';
import * as smStandings from '../services/sportmonks/sportmonksStandings.js';
import * as smLeagues from '../services/sportmonks/sportmonksLeagues.js';
import { mapFixture, mapPlayerMatchStats, mapTeam, mapPlayer, mapEvent } from '../utils/sportmonksMapper.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';

const router = Router();

/**
 * Enriquece un fixture con nombres y logos de equipos desde la BD.
 * Evita N+1 queries precargando teams usados.
 */
async function enrichFixtures(fixtures) {
  if (!fixtures || fixtures.length === 0) return fixtures;

  // Static league names for our 7 covered leagues
  const LEAGUE_NAMES = {
    636: 'Liga Profesional Argentina',
    642: 'Copa Argentina',
    8: 'Premier League',
    564: 'La Liga',
    384: 'Serie A',
    241: 'Copa Libertadores',
    243: 'Copa Sudamericana',
  };

  // Collect unique team IDs
  const teamIds = new Set();
  for (const f of fixtures) {
    if (f.homeTeamId) teamIds.add(f.homeTeamId);
    if (f.awayTeamId) teamIds.add(f.awayTeamId);
  }

  // Batch fetch teams
  const teams = await prisma.team.findMany({
    where: { externalId: { in: [...teamIds] }, source: 'sportmonks' },
    select: { externalId: true, name: true, logo: true },
  });
  const teamMap = new Map(teams.map(t => [t.externalId, t]));

  return fixtures.map(f => {
    const home = teamMap.get(f.homeTeamId);
    const away = teamMap.get(f.awayTeamId);
    return {
      ...f,
      homeTeamName: home?.name || null,
      homeTeamLogo: home?.logo || null,
      awayTeamName: away?.name || null,
      awayTeamLogo: away?.logo || null,
      leagueName: LEAGUE_NAMES[f.leagueId] || null,
    };
  });
}

// ═══════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════

/**
 * GET /api/sportmonks/fixtures/live
 * Partidos en vivo de las ligas cubiertas por Sportmonks (desde BD)
 */
router.get('/fixtures/live', async (req, res, next) => {
  try {
    // 1. Llamar a la API de livescores para actualizar BD con datos frescos
    const elapsedMap = new Map();
    try {
      const apiData = await smFixtures.getLiveMatches();
      const liveApiFixtures = apiData?.data || [];

      for (const fixture of liveApiFixtures) {
        const mapped = mapFixture(fixture);

        // Extract elapsed from state or periods
        const activePeriod = fixture.periods?.find(p => p.ticking) || fixture.periods?.[fixture.periods.length - 1];
        const elapsed = fixture.state?.clock?.minute ?? fixture.clock?.minute ?? activePeriod?.minutes ?? null;
        if (elapsed !== null) {
          elapsedMap.set(mapped.externalId, elapsed);
        }

        try {
          await prisma.fixture.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: { ...mapped, isLive: mapped.status === 'live' },
            create: { ...mapped, isLive: mapped.status === 'live' },
          });
        } catch (e) { /* skip */ }
      }
    } catch (apiErr) {
      console.error('[Sportmonks Routes] Error fetching live:', apiErr.message);
    }

    // 2. Leer de BD (ya actualizada)
    const liveFixtures = await prisma.fixture.findMany({
      where: { isLive: true, source: 'sportmonks' },
      orderBy: { startTime: 'asc' },
    });

    // Agrupar por liga
    const byLeague = {};
    const enriched = await enrichFixtures(liveFixtures);
    for (const f of enriched) {
      f.elapsed = elapsedMap.get(f.externalId) || null;
      if (!byLeague[f.leagueId]) {
        byLeague[f.leagueId] = { leagueId: f.leagueId, fixtures: [] };
      }
      byLeague[f.leagueId].fixtures.push(f);
    }

    res.json({
      total: enriched.length,
      grouped: Object.values(byLeague),
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/today-complete?date=YYYY-MM-DD
 * Endpoint unificado: trae live + date, mergea (live gana), ordena y devuelve un solo array.
 * El frontend solo llama a este endpoint → un solo set() → un solo render.
 */
router.get('/fixtures/today-complete', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const dateStart = new Date(`${date}T00:00:00.000-03:00`);
    const dateEnd = new Date(`${date}T23:59:59.999-03:00`);

    // ── 1. Fetch live desde API Sportmonks (sin cache) ──
    const liveElapsedMap = new Map();
    const liveExternalIds = new Set();
    try {
      const apiData = await smFixtures.getLiveMatches();
      const liveApiFixtures = apiData?.data || [];

      for (const fixture of liveApiFixtures) {
        const mapped = mapFixture(fixture);
        liveExternalIds.add(mapped.externalId);

        // Extract elapsed from state or periods
        const activePeriod = fixture.periods?.find(p => p.ticking) || fixture.periods?.[fixture.periods.length - 1];
        const elapsed = fixture.state?.clock?.minute ?? fixture.clock?.minute ?? activePeriod?.minutes ?? null;
        if (elapsed !== null) {
          liveElapsedMap.set(mapped.externalId, elapsed);
        }

        try {
          await prisma.fixture.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: { ...mapped, isLive: mapped.status === 'live' },
            create: { ...mapped, isLive: mapped.status === 'live' },
          });
        } catch (e) { /* skip */ }
      }
    } catch (apiErr) {
      console.error('[SM today-complete] Error fetching live:', apiErr.message);
    }

    // ── 2. Fetch date desde API Sportmonks (cache 2 min) ──
    const dateElapsedMap = new Map();
    try {
      const apiFixtures = await cachedApiCall(`sm:date_api:${date}`, 120, async () => {
        const apiData = await smFixtures.getFixturesByDate(date);
        return apiData?.data || [];
      });

      for (const fixture of apiFixtures) {
        const mapped = mapFixture(fixture);

        // Si ya lo trajo el live, NO pisar con data del date (que puede estar atrasada)
        if (liveExternalIds.has(mapped.externalId)) continue;

        // Extract elapsed from state or periods
        const activePeriod = fixture.periods?.find(p => p.ticking) || fixture.periods?.[fixture.periods.length - 1];
        const elapsed = fixture.state?.clock?.minute ?? fixture.clock?.minute ?? activePeriod?.minutes ?? null;
        if (elapsed !== null) {
          dateElapsedMap.set(mapped.externalId, elapsed);
        }

        try {
          await prisma.fixture.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: { ...mapped, isLive: mapped.status === 'live' },
            create: { ...mapped, isLive: mapped.status === 'live' },
          });
        } catch (e) { /* skip */ }
      }
    } catch (apiErr) {
      console.error(`[SM today-complete] Error fetching date ${date}:`, apiErr.message);
    }

    // ── 3. Leer de BD (ya actualizada con ambas fuentes) ──
    const allFixtures = await prisma.fixture.findMany({
      where: {
        source: 'sportmonks',
        startTime: { gte: dateStart, lte: dateEnd },
      },
    });

    const enriched = await enrichFixtures(allFixtures);

    // Attach elapsed
    for (const f of enriched) {
      f.elapsed = liveElapsedMap.get(f.externalId) || dateElapsedMap.get(f.externalId) || null;
    }

    // ── 4. Ordenar: en vivo (por elapsed desc), luego por startTime asc ──
    enriched.sort((a, b) => {
      const aLive = a.isLive || a.status === 'live';
      const bLive = b.isLive || b.status === 'live';
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      if (aLive && bLive) return (b.elapsed || 0) - (a.elapsed || 0);
      return new Date(a.startTime) - new Date(b.startTime);
    });

    const liveCount = enriched.filter(f => f.isLive || f.status === 'live').length;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ total: enriched.length, liveCount, fixtures: enriched });
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/date/:date
 * Fixtures de una fecha específica (YYYY-MM-DD).
 * Primero busca en BD, si no hay nada busca en API y persiste.
 */
router.get('/fixtures/date/:date', async (req, res, next) => {
  try {
    const date = req.params.date; // YYYY-MM-DD
    
    // Bounds in local time (Argentina UTC-3)
    // Local 00:00:00 -> UTC 03:00:00
    // Local 23:59:59.999 -> Next day UTC 02:59:59.999
    const dateStart = new Date(`${date}T00:00:00.000-03:00`);
    const dateEnd = new Date(`${date}T23:59:59.999-03:00`);

    // Llamar a la API pero con un cache de 2 min para proteger rate limits.
    // Sportmonks cachea el endpoint /date de su lado, por lo que consultarlo a cada recarga sobreescribe datos reales de /live.
    const elapsedMap = new Map(); // externalId -> elapsed minutes
    try {
      const apiFixtures = await cachedApiCall(`sm:date_api:${date}`, 120, async () => {
        const apiData = await smFixtures.getFixturesByDate(date);
        return apiData?.data || [];
      });

      // Precargar los partidos de hoy desde BD para evitar que el endpoint /date (lento/cacheado) 
      // ponga un partido en 'NS' o 'TBD' si en /live ya está en curso.
      const existingMatches = await prisma.fixture.findMany({
        where: {
          source: 'sportmonks',
          startTime: { gte: dateStart, lte: dateEnd },
        },
        select: { externalId: true, isLive: true, status: true }
      });
      const existingMap = new Map(existingMatches.map(m => [m.externalId, m]));

      for (const fixture of apiFixtures) {
        const mapped = mapFixture(fixture);

        // Proteccion: Si el DB tiene isLive=true y la API dice que todavia no empezó (scheduled), no sobreescribir.
        // Esto pasa porque el endpoint por fecha de Sportmonks tiene delay de cache en su lado.
        const existing = existingMap.get(mapped.externalId);
        if (existing?.isLive && ['scheduled'].includes(mapped.status)) {
           // Ignorar override destructivo
           mapped.status = existing.status;
           mapped.isLive = true;
        }

        // Extract elapsed from state
        const elapsed = fixture.state?.clock?.minute ?? fixture.clock?.minute ?? null;
        if (elapsed !== null) {
          elapsedMap.set(mapped.externalId, elapsed);
        }

        try {
          await prisma.fixture.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: { ...mapped, isLive: mapped.status === 'live' || !!mapped.isLive },
            create: { ...mapped, isLive: mapped.status === 'live' || !!mapped.isLive },
          });
        } catch (e) { /* skip individual errors */ }
      }
    } catch (apiErr) {
      console.error(`[Sportmonks Routes] Error fetching date ${date}:`, apiErr.message);
    }

    // Fetch desde BD (ya actualizada)
    const fixtures = await prisma.fixture.findMany({
      where: {
        source: 'sportmonks',
        startTime: { gte: dateStart, lte: dateEnd },
      },
      orderBy: { startTime: 'asc' },
    });

    const enriched = await enrichFixtures(fixtures);

    // Attach elapsed minutes for live matches
    for (const f of enriched) {
      f.elapsed = elapsedMap.get(f.externalId) || null;
    }

    res.json(enriched);
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId
 * Detalle base de un partido (Lazy loading).
 */
router.get('/fixtures/:fixtureId', async (req, res, next) => {
  try {
    const fixtureId = req.params.fixtureId;

    // 1. Buscar en BD
    let fixture = await prisma.fixture.findFirst({
      where: {
        source: 'sportmonks',
        OR: [
          { externalId: fixtureId },
          { id: fixtureId },
        ],
      },
    });

    let elapsed = null;
    const externalId = fixture?.externalId || fixtureId;

    try {
      console.log(`[Sportmonks] Fetching BASE detail for fixture ${externalId}`);
      const apiData = await smFixtures.getBaseFixtureById(externalId);
      const smFixture = apiData?.data;

      if (smFixture) {
        // Extract elapsed from state (with periods fallback for detail endpoint)
        const periods = smFixture.periods || [];
        const activePeriod = periods.find(p => p.ticking) || periods[periods.length - 1];
        elapsed = smFixture.state?.clock?.minute ?? activePeriod?.minutes ?? null;

        const mapped = mapFixture(smFixture);

        const needsDbUpdate = !fixture
          || fixture.status !== mapped.status
          || fixture.homeScore !== mapped.homeScore
          || fixture.awayScore !== mapped.awayScore
          || mapped.status === 'live';

        if (needsDbUpdate) {
          fixture = await prisma.fixture.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: { ...mapped, isLive: mapped.status === 'live' },
            create: { ...mapped, isLive: mapped.status === 'live' },
          });
        }
      }
    } catch (apiErr) {
      console.error(`[Sportmonks Routes] API Base Error: ${apiErr.message}`);
    }

    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    
    // Enrich para asegurar nombres de equipos
    const enriched = (await enrichFixtures([fixture]))[0];

    // Solo retornamos los data base sin engordar el payload
    res.json({
      ...enriched,
      elapsed,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId/lineups
 * Formaciones de un partido. Lazy load.
 */
router.get('/fixtures/:fixtureId/lineups', async (req, res, next) => {
  try {
    const apiData = await smFixtures.getFixtureLineups(req.params.fixtureId);
    res.json(apiData?.data?.lineups || []);
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId/events
 * Eventos de un partido. Lazy load.
 */
router.get('/fixtures/:fixtureId/events', async (req, res, next) => {
  try {
    const apiData = await smFixtures.getFixtureEvents(req.params.fixtureId);
    res.json(apiData?.data?.events || []);
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId/statistics
 * Estadísticas de equipo de un partido. Lazy load.
 */
router.get('/fixtures/:fixtureId/statistics', async (req, res, next) => {
  try {
    const apiData = await smFixtures.getFixtureStatistics(req.params.fixtureId);
    res.json(apiData?.data?.statistics || []);
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId/h2h
 * Head to head de dos equipos de un partido. Lazy load.
 */
router.get('/fixtures/:fixtureId/h2h/:team1Id/:team2Id', async (req, res, next) => {
  try {
    const { team1Id, team2Id } = req.params;
    const apiData = await smFixtures.getHeadToHead(team1Id, team2Id);
    
    // Sort desc by starting_at to get latest 5 encounters
    let h2h = apiData?.data || [];
    h2h.sort((a, b) => new Date(b.starting_at) - new Date(a.starting_at));
    h2h = h2h.slice(0, 5);
    
    res.json(h2h);
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/fixtures/:fixtureId/player-stats
 * Stats y ratings de todos los jugadores del partido (para fantasy/prode).
 * Si no hay stats en BD, las busca en API y persiste.
 */
router.get('/fixtures/:fixtureId/player-stats', async (req, res, next) => {
  try {
    const fixtureId = req.params.fixtureId;

    // Buscar fixture en BD
    const fixture = await prisma.fixture.findFirst({
      where: {
        source: 'sportmonks',
        OR: [{ externalId: fixtureId }, { id: fixtureId }],
      },
      include: { playerStats: true },
    });

    if (!fixture) {
      return res.status(404).json({ error: 'Fixture no encontrado' });
    }

    // Si ya tiene player stats, devolverlas
    if (fixture.playerStats.length > 0) {
      return res.json(fixture.playerStats);
    }

    // Si no tiene stats y el partido terminó, buscar en API
    if (fixture.status === 'finished') {
      try {
        const apiData = await smFixtures.getFixtureWithPlayerStats(fixture.externalId);
        const lineups = apiData?.data?.lineups || [];

        for (const lineupPlayer of lineups) {
          const smEvents = apiData?.data?.events || [];
          const stats = mapPlayerMatchStats(lineupPlayer, smEvents);
          if (!stats.playerId) continue;

          await prisma.playerMatchStat.upsert({
            where: {
              fixtureId_playerId: { fixtureId: fixture.id, playerId: stats.playerId },
            },
            update: { ...stats, updatedAt: new Date() },
            create: { ...stats, fixtureId: fixture.id },
          });
        }

        // Re-fetch
        const updatedStats = await prisma.playerMatchStat.findMany({
          where: { fixtureId: fixture.id },
          orderBy: { rating: 'desc' },
        });

        return res.json(updatedStats);
      } catch (apiErr) {
        console.error(`[Sportmonks Routes] Error fetching player stats:`, apiErr.message);
      }
    }

    // Si el partido no terminó, devolver vacío
    res.json([]);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// STANDINGS
// ═══════════════════════════════════════

/**
 * GET /api/sportmonks/standings/:leagueId
 * Tabla de posiciones (cacheada 2h, fallback API).
 */
router.get('/standings/:leagueId', async (req, res, next) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const cacheKey = `sm:standings:${leagueId}`;

    const data = await cachedApiCall(cacheKey, 7200, async () => {
      // Primero necesitamos la temporada actual de la liga
      const leagueData = await smLeagues.getCurrentSeason(leagueId);
      const seasonId = leagueData?.data?.currentseason?.id
        || leagueData?.data?.current_season?.id;

      if (!seasonId) return null;

      const standings = await smStandings.getStandingsBySeason(seasonId);
      return standings?.data || null;
    });

    if (!data) {
      return res.status(404).json({ error: 'Standings no disponibles para esta liga' });
    }

    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════

/**
 * GET /api/sportmonks/teams/:teamId
 * Datos de un equipo (BD primero, fallback API).
 */
router.get('/teams/:teamId', async (req, res, next) => {
  try {
    const teamId = Number(req.params.teamId);

    // Buscar en BD local
    let team = await prisma.team.findUnique({
      where: { externalId_source: { externalId: teamId, source: 'sportmonks' } },
      include: { players: true, coaches: true },
    });

    // Si no existe, buscar en API y persistir
    if (!team) {
      try {
        const apiData = await smTeams.getTeamById(teamId);
        if (apiData?.data) {
          const mapped = mapTeam(apiData.data);
          team = await prisma.team.upsert({
            where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
            update: mapped,
            create: mapped,
            include: { players: true, coaches: true },
          });
        }
      } catch (apiErr) {
        console.error(`[Sportmonks Routes] Error fetching team ${teamId}:`, apiErr.message);
      }
    }

    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json(team);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// PLAYERS
// ═══════════════════════════════════════

/**
 * GET /api/sportmonks/players/:playerId
 * Datos de un jugador (cacheado 6h).
 */
router.get('/players/:playerId', async (req, res, next) => {
  try {
    const playerId = Number(req.params.playerId);
    const cacheKey = `sm:player:${playerId}`;

    const data = await cachedApiCall(cacheKey, 21600, async () => {
      const result = await smPlayers.getPlayerById(playerId);
      return result?.data || null;
    });

    if (!data) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(data);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// LEAGUES
// ═══════════════════════════════════════

/**
 * GET /api/sportmonks/leagues
 * Lista de ligas cubiertas con su temporada actual (cacheado 24h).
 */
router.get('/leagues', async (req, res, next) => {
  try {
    const cacheKey = 'sm:leagues:covered';

    const data = await cachedApiCall(cacheKey, 86400, async () => {
      const result = await smLeagues.getCoveredLeagues();
      return result?.data || [];
    });

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      leagueIds: SPORTMONKS_LEAGUE_IDS,
      leagues: data,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/sportmonks/teams/:teamId/full
 * Detalle completo de un equipo y todo su grafo relacional.
 * Proxy transparente directo contra API On-Demand para la vista de Explorador de Equipo.
 */
router.get('/teams/:teamId/full', async (req, res, next) => {
  try {
    const teamId = req.params.teamId;
    console.log(`[Sportmonks Routes] Proxying team profile for ${teamId}`);
    const apiData = await smTeams.getTeamById(teamId);
    
    // No persistimos este volumen colosal en BD (stats, bajas, historico). Solo lo exponemos
    if (!apiData?.data) {
      return res.status(404).json({ error: 'Team not found in provider' });
    }
    
    return res.json(apiData.data);
  } catch (err) { next(err); }
});

export default router;
