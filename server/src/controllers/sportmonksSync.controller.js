/**
 * Controller: Sincronización inicial de Sportmonks
 * Endpoint admin para poblar la BD con datos estáticos por primera vez.
 * Responde 202 Accepted y procesa en background.
 */
import prisma from '../config/database.js';
import { runStaticSync } from '../jobs/syncStatic.job.js';
import { runFixturesSync } from '../jobs/syncFixtures.job.js';
import { getCoveredLeagues, getCurrentSeason } from '../services/sportmonks/sportmonksLeagues.js';
import { getTeamsBySeason } from '../services/sportmonks/sportmonksTeams.js';
import { getSquadByTeam } from '../services/sportmonks/sportmonksPlayers.js';
import { getFixturesBySeason } from '../services/sportmonks/sportmonksFixtures.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';
import { mapTeam, mapPlayer, mapFixture } from '../utils/sportmonksMapper.js';

// Track sync status
let syncStatus = {
  isRunning: false,
  startedAt: null,
  completedAt: null,
  progress: '',
  error: null,
  results: null,
};

/**
 * POST /api/admin/sportmonks/sync-initial
 * Ejecutable solo con token de admin/superadmin.
 * Lanza sync completo en background.
 */
export async function syncInitial(req, res) {
  if (syncStatus.isRunning) {
    return res.status(409).json({
      error: 'Ya hay una sincronización en curso',
      status: syncStatus,
    });
  }

  // Responder inmediatamente
  res.status(202).json({
    message: 'Sincronización inicial iniciada en background',
    status: 'running',
    checkStatusAt: '/api/admin/sportmonks/sync-status',
  });

  // Ejecutar en background
  runFullSync().catch(err => {
    console.error('[Sportmonks Sync] Error fatal:', err);
    syncStatus.error = err.message;
    syncStatus.isRunning = false;
  });
}

/**
 * GET /api/admin/sportmonks/sync-status
 * Estado actual de la sincronización.
 */
export function getSyncStatus(req, res) {
  res.json(syncStatus);
}

/**
 * POST /api/admin/sportmonks/sync-fixtures
 * Forzar sync de fixtures (hoy + mañana + pasado).
 */
export async function syncFixturesNow(req, res, next) {
  try {
    await runFixturesSync();
    res.json({ message: 'Fixtures sincronizados correctamente' });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/sportmonks/sync-static
 * Forzar sync de datos estáticos (equipos, jugadores).
 */
export async function syncStaticNow(req, res, next) {
  try {
    await runStaticSync();
    res.json({ message: 'Datos estáticos sincronizados correctamente' });
  } catch (err) { next(err); }
}

/**
 * Sync completo: ligas → temporadas → equipos → plantillas → fixtures
 * Puede tardar varios minutos.
 */
async function runFullSync() {
  syncStatus = {
    isRunning: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    progress: 'Iniciando...',
    error: null,
    results: { leagues: 0, teams: 0, players: 0, fixtures: 0 },
  };

  const results = syncStatus.results;

  try {
    // ── PASO 1: Obtener ligas cubiertas ──
    syncStatus.progress = 'Obteniendo ligas cubiertas...';
    console.log('[Sync Initial] Paso 1: Obteniendo ligas...');

    const leagues = await getCoveredLeagues();
    const leagueList = leagues?.data || [];
    results.leagues = leagueList.length;
    console.log(`[Sync Initial]   ✓ ${leagueList.length} ligas obtenidas`);

    // ── PASO 2: Para cada liga, obtener temporada actual y equipos ──
    for (let i = 0; i < SPORTMONKS_LEAGUE_IDS.length; i++) {
      const leagueId = SPORTMONKS_LEAGUE_IDS[i];
      syncStatus.progress = `Liga ${i + 1}/${SPORTMONKS_LEAGUE_IDS.length} (ID: ${leagueId}) — equipos...`;

      try {
        const leagueData = await getCurrentSeason(leagueId);
        const seasonId = leagueData?.data?.currentseason?.id
          || leagueData?.data?.current_season?.id;

        if (!seasonId) {
          console.warn(`[Sync Initial]   ⚠ Liga ${leagueId}: sin temporada actual`);
          continue;
        }

        // Sync equipos
        const teamsData = await getTeamsBySeason(seasonId);
        const teams = teamsData?.data || [];

        for (const smTeam of teams) {
          const mapped = mapTeam(smTeam);
          try {
            await prisma.team.upsert({
              where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
              update: mapped,
              create: mapped,
            });
            results.teams++;
          } catch (e) { /* skip duplicates */ }
        }

        console.log(`[Sync Initial]   ✓ Liga ${leagueId}: ${teams.length} equipos`);
        await new Promise(r => setTimeout(r, 400));

        // ── PASO 3: Plantillas ──
        syncStatus.progress = `Liga ${i + 1}/${SPORTMONKS_LEAGUE_IDS.length} (ID: ${leagueId}) — plantillas...`;

        for (const smTeam of teams) {
          try {
            const squadData = await getSquadByTeam(smTeam.id);
            const squadEntries = squadData?.data || [];

            const localTeam = await prisma.team.findUnique({
              where: { externalId_source: { externalId: smTeam.id, source: 'sportmonks' } },
            });

            for (const entry of squadEntries) {
              const player = entry.player;
              if (!player || !player.id) continue;

              const mappedPlayer = mapPlayer(player, localTeam?.id || null);

              try {
                await prisma.player.upsert({
                  where: { externalId_source: { externalId: mappedPlayer.externalId, source: 'sportmonks' } },
                  update: mappedPlayer,
                  create: mappedPlayer,
                });
                results.players++;
              } catch (e) { /* skip */ }
            }

            await new Promise(r => setTimeout(r, 350));
          } catch (err) {
            console.warn(`[Sync Initial]   ⚠ Squad ${smTeam.id}: ${err.message}`);
          }
        }

        // ── PASO 4: Fixtures de la temporada ──
        syncStatus.progress = `Liga ${i + 1}/${SPORTMONKS_LEAGUE_IDS.length} (ID: ${leagueId}) — fixtures...`;

        try {
          const seasonFixtures = await getFixturesBySeason(seasonId);

          for (const fixture of seasonFixtures) {
            const mapped = mapFixture(fixture);
            try {
              await prisma.fixture.upsert({
                where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
                update: mapped,
                create: mapped,
              });
              results.fixtures++;
            } catch (e) { /* skip */ }
          }

          console.log(`[Sync Initial]   ✓ Liga ${leagueId}: ${seasonFixtures.length} fixtures`);
        } catch (err) {
          console.warn(`[Sync Initial]   ⚠ Fixtures liga ${leagueId}: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Sync Initial]   ✗ Error liga ${leagueId}:`, err.message);
      }
    }

    syncStatus.progress = 'Completado';
    syncStatus.completedAt = new Date().toISOString();
    syncStatus.isRunning = false;

    console.log(`[Sync Initial] ✅ Completado — ${results.leagues} ligas, ${results.teams} equipos, ${results.players} jugadores, ${results.fixtures} fixtures`);
  } catch (err) {
    syncStatus.error = err.message;
    syncStatus.isRunning = false;
    console.error('[Sync Initial] ✗ Error fatal:', err);
  }
}
