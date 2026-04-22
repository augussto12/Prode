/**
 * Cron Job: Sincronización de Fixtures de Sportmonks
 * Ejecuta cada 3 horas
 * Sincroniza: fixtures de hoy y mañana → upsert en BD
 *
 * Objetivo: tener siempre los fixtures próximos en BD para que el frontend
 * los consuma sin necesidad de llamar a la API de Sportmonks.
 */
import cron from 'node-cron';
import prisma from '../config/database.js';
import { getFixturesByDate } from '../services/sportmonks/sportmonksFixtures.js';
import { getStandingsBySeason } from '../services/sportmonks/sportmonksStandings.js';
import { getCurrentSeason } from '../services/sportmonks/sportmonksLeagues.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';
import { mapFixture } from '../utils/sportmonksMapper.js';
import { syncAllRounds } from './syncRounds.helper.js';

// Track para ejecutar sync de rounds solo 1 vez por día
let lastRoundsSyncDate = null;

/**
 * Obtiene la fecha en formato YYYY-MM-DD con offset de días.
 * @param {number} offsetDays - Días a sumar/restar desde hoy
 * @returns {string}
 */
function getDateString(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split('T')[0];
}

/**
 * Sincroniza fixtures de una fecha determinada.
 * @param {string} date - YYYY-MM-DD
 * @returns {{ created: number, updated: number }}
 */
async function syncFixturesForDate(date) {
  const data = await getFixturesByDate(date);
  const fixtures = data?.data || [];
  let created = 0;
  let updated = 0;

  for (const fixture of fixtures) {
    const mapped = mapFixture(fixture);

    try {
      const existing = await prisma.fixture.findUnique({
        where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
      });

      if (existing) {
        // Protección contra caché de la API por fecha de Sportmonks (stale data):
        if (existing.isLive && ['scheduled'].includes(mapped.status)) {
           mapped.status = existing.status;
        }

        await prisma.fixture.update({
          where: { id: existing.id },
          data: mapped,
        });
        updated++;
      } else {
        await prisma.fixture.create({ data: mapped });
        created++;
      }
    } catch (err) {
      console.error(`[Cron Fixtures] Error upserting fixture ${mapped.externalId}:`, err.message);
    }
  }

  return { date, created, updated, total: fixtures.length };
}

/**
 * Sincroniza standings de las ligas cubiertas.
 * Se guardan en cache de memoria (el endpoint los sirve desde Sportmonks on-demand).
 * Aquí solo nos aseguramos de que los fixtures estén actualizados.
 */
async function syncStandingsForLeagues() {
  let synced = 0;

  for (const leagueId of SPORTMONKS_LEAGUE_IDS) {
    try {
      const leagueData = await getCurrentSeason(leagueId);
      const seasonId = leagueData?.data?.currentseason?.id
        || leagueData?.data?.current_season?.id;

      if (!seasonId) continue;

      // Traer standings para tenerlos frescos (el endpoint los cacheará)
      await getStandingsBySeason(seasonId);
      synced++;

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      // No es crítico — standings se pueden obtener on-demand
      console.warn(`[Cron Fixtures] Standings liga ${leagueId}: ${err.message}`);
    }
  }

  return synced;
}

/**
 * Job principal: sincroniza fixtures de hoy, mañana y pasado mañana.
 */
async function runFixturesSync() {
  console.log('[Cron] ▶ Sincronizando fixtures de Sportmonks...');
  const startTime = Date.now();

  try {
    // Sincronizar: 2 días atrás (correcciones) + hoy + 13 días adelante = 16 fechas
    const dates = Array.from({ length: 16 }, (_, i) => getDateString(i - 2));

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const date of dates) {
      const result = await syncFixturesForDate(date);
      totalCreated += result.created;
      totalUpdated += result.updated;
      console.log(`[Cron]   ✓ ${date}: ${result.total} fixtures (${result.created} nuevos, ${result.updated} actualizados)`);

      // Rate limit entre fechas
      await new Promise(r => setTimeout(r, 500));
    }

    // También sync standings (background, no crítico)
    const standingsSynced = await syncStandingsForLeagues();

    // Sync rounds una vez por día (primera ejecución del día)
    const today = getDateString(0);
    let roundsMsg = '';
    if (lastRoundsSyncDate !== today) {
      try {
        const roundsResult = await syncAllRounds(SPORTMONKS_LEAGUE_IDS);
        lastRoundsSyncDate = today;
        roundsMsg = `, rounds: +${roundsResult.totalCreated}/~${roundsResult.totalUpdated}`;
      } catch (err) {
        console.error('[Cron] Error en sync de rounds:', err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] ✅ Fixtures sync completado en ${elapsed}s — +${totalCreated}/~${totalUpdated} fixtures, ${standingsSynced} standings${roundsMsg}`);
  } catch (err) {
    console.error('[Cron] ✗ Error en sync fixtures:', err.message);
  }
}

/**
 * Arranca el cron job de fixtures sync.
 * Ejecuta cada 3 horas.
 */
export function startFixturesSyncJob() {
  cron.schedule('0 */3 * * *', runFixturesSync);
  console.log('  📅 Fixtures sync: programado cada 3 horas');
}

// Exportar para ejecución manual
export { runFixturesSync };
