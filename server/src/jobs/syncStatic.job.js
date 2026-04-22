/**
 * Cron Job: Sincronización de datos estáticos de Sportmonks
 * Ejecuta una vez al día a las 3:00 AM
 * Sincroniza: ligas → temporadas actuales → equipos → jugadores (plantillas)
 *
 * Estrategia: upsert en BD para minimizar llamadas futuras a la API.
 */
import cron from 'node-cron';
import prisma from '../config/database.js';
import { getCoveredLeagues, getCurrentSeason } from '../services/sportmonks/sportmonksLeagues.js';
import { getTeamsBySeason } from '../services/sportmonks/sportmonksTeams.js';
import { getSquadByTeam } from '../services/sportmonks/sportmonksPlayers.js';
import { SPORTMONKS_LEAGUE_IDS } from '../constants/sportmonks.constants.js';
import { mapTeam, mapPlayer } from '../utils/sportmonksMapper.js';
import { syncAllRounds } from './syncRounds.helper.js';

/**
 * Sincroniza equipos de una temporada y los persiste en BD.
 * @param {number} seasonId
 * @returns {{ created: number, updated: number }}
 */
async function syncTeamsForSeason(seasonId) {
  const data = await getTeamsBySeason(seasonId);
  const teams = data?.data || [];
  let created = 0;
  let updated = 0;

  for (const smTeam of teams) {
    const mapped = mapTeam(smTeam);

    const existing = await prisma.team.findUnique({
      where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
    });

    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data: mapped,
      });
      updated++;
    } else {
      await prisma.team.create({ data: mapped });
      created++;
    }
  }

  return { created, updated, total: teams.length };
}

/**
 * Sincroniza la plantilla (jugadores) de un equipo.
 * @param {number} smTeamId - External ID del equipo en Sportmonks
 */
async function syncSquadForTeam(smTeamId) {
  const data = await getSquadByTeam(smTeamId);
  const squadEntries = data?.data || [];
  let created = 0;
  let updated = 0;

  // Buscar el team local para linkear via FK
  const localTeam = await prisma.team.findUnique({
    where: { externalId_source: { externalId: smTeamId, source: 'sportmonks' } },
  });
  const localTeamId = localTeam?.id || null;

  for (const entry of squadEntries) {
    const player = entry.player;
    if (!player) continue;

    const mapped = mapPlayer(player, localTeamId);

    // externalId puede ser null para players sin dato — skip
    if (!mapped.externalId) continue;

    const existing = await prisma.player.findUnique({
      where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
    });

    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: mapped,
      });
      updated++;
    } else {
      await prisma.player.create({ data: mapped });
      created++;
    }
  }

  return { teamId: smTeamId, created, updated };
}

/**
 * Job principal: sincroniza todo lo estático.
 */
async function runStaticSync() {
  console.log('[Cron] ▶ Iniciando sync de datos estáticos de Sportmonks...');
  const startTime = Date.now();

  try {
    // 1. Sync ligas cubiertas (log informativo)
    const leagues = await getCoveredLeagues();
    const leagueList = leagues?.data || [];
    console.log(`[Cron]   ✓ ${leagueList.length} ligas obtenidas de Sportmonks`);

    // 2. Para cada liga, obtener temporada actual y sincronizar equipos
    let totalTeams = { created: 0, updated: 0 };
    let totalSquads = { created: 0, updated: 0 };

    for (const leagueId of SPORTMONKS_LEAGUE_IDS) {
      try {
        const leagueData = await getCurrentSeason(leagueId);
        const currentSeasonId = leagueData?.data?.currentseason?.id
          || leagueData?.data?.current_season?.id;

        if (!currentSeasonId) {
          console.warn(`[Cron]   ⚠ Liga ${leagueId}: no se encontró temporada actual`);
          continue;
        }

        // Sync equipos
        const teamResult = await syncTeamsForSeason(currentSeasonId);
        totalTeams.created += teamResult.created;
        totalTeams.updated += teamResult.updated;
        console.log(`[Cron]   ✓ Liga ${leagueId}: ${teamResult.total} equipos (${teamResult.created} nuevos, ${teamResult.updated} actualizados)`);

        // Pequeña espera para no saturar el rate limit
        await new Promise(r => setTimeout(r, 500));

        // 3. Sync plantillas de los equipos nuevos (que no tienen jugadores)
        const teamsInSeason = await prisma.team.findMany({
          where: { source: 'sportmonks' },
          select: { id: true, externalId: true, _count: { select: { players: true } } },
        });

        // Solo sincronizar plantillas de equipos sin jugadores (primera vez)
        const teamsWithoutPlayers = teamsInSeason.filter(t => t._count.players === 0);

        for (const team of teamsWithoutPlayers.slice(0, 10)) { // Max 10 por ciclo
          try {
            const squadResult = await syncSquadForTeam(team.externalId);
            totalSquads.created += squadResult.created;
            totalSquads.updated += squadResult.updated;

            // Rate limit: 500ms entre cada squad request
            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            console.error(`[Cron]   ✗ Error squad equipo ${team.externalId}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[Cron]   ✗ Error procesando liga ${leagueId}:`, err.message);
      }

      // Rate limit: 300ms entre cada liga
      await new Promise(r => setTimeout(r, 300));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] ✅ Sync estático completado en ${elapsed}s — Equipos: +${totalTeams.created}/~${totalTeams.updated} | Jugadores: +${totalSquads.created}/~${totalSquads.updated}`);
  } catch (err) {
    console.error('[Cron] ✗ Error fatal en sync estático:', err.message);
  }
}

/**
 * Job de sync semanal de rounds.
 * Ejecuta todos los lunes a las 4:00 AM.
 */
async function runRoundsSync() {
  console.log('[Cron] ▶ Sync semanal de rounds...');
  try {
    await syncAllRounds(SPORTMONKS_LEAGUE_IDS);
  } catch (err) {
    console.error('[Cron] ✗ Error en sync semanal de rounds:', err.message);
  }
}

/**
 * Arranca los cron jobs de sync estático.
 */
export function startStaticSyncJob() {
  // Datos estáticos (equipos, jugadores): diario 3AM
  cron.schedule('0 3 * * *', runStaticSync);
  console.log('  📦 Static sync: programado a las 03:00 AM diariamente');

  // Rounds completas: lunes 4AM
  cron.schedule('0 4 * * 1', runRoundsSync);
  console.log('  📅 Rounds sync: programado lunes 04:00 AM');
}

// Exportar para ejecución manual (sync inicial)
export { runStaticSync, runRoundsSync };
