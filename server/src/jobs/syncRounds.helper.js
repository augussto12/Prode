/**
 * Helper: Sync de Rounds de Sportmonks → tabla SportmonksRound
 * Compartido entre syncFixtures.job.js (diario) y syncStatic.job.js (semanal).
 */
import prisma from '../config/database.js';
import { getCurrentSeason, getRoundsBySeason } from '../services/sportmonks/sportmonksLeagues.js';

/**
 * Sincroniza todas las rounds de una liga para su temporada actual.
 * @param {number} leagueId - ID de liga Sportmonks
 * @returns {{ created: number, updated: number, total: number, seasonId: number|null }}
 */
export async function syncRoundsForLeague(leagueId) {
  const lg = await getCurrentSeason(leagueId);
  const seasonId = lg?.data?.currentseason?.id || lg?.data?.current_season?.id;

  if (!seasonId) {
    console.warn(`[Rounds] Liga ${leagueId}: no se encontró temporada actual`);
    return { created: 0, updated: 0, total: 0, seasonId: null };
  }

  const roundsRes = await getRoundsBySeason(seasonId);
  const rounds = roundsRes?.data || [];

  if (rounds.length === 0) {
    return { created: 0, updated: 0, total: 0, seasonId };
  }

  let created = 0;
  let updated = 0;

  for (const round of rounds) {
    try {
      const existing = await prisma.sportmonksRound.findUnique({
        where: { roundId_leagueId: { roundId: round.id, leagueId } },
      });

      const data = {
        roundId: round.id,
        leagueId,
        seasonId,
        name: round.name || String(round.id),
        startDate: round.starting_at ? new Date(round.starting_at) : null,
        endDate: round.ending_at ? new Date(round.ending_at) : null,
      };

      if (existing) {
        await prisma.sportmonksRound.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.sportmonksRound.create({ data });
        created++;
      }
    } catch (err) {
      console.error(`[Rounds] Error upsert round ${round.id} liga ${leagueId}:`, err.message);
    }
  }

  return { created, updated, total: rounds.length, seasonId };
}

/**
 * Sincroniza rounds de todas las ligas cubiertas.
 * @param {number[]} leagueIds - Array de IDs de ligas
 * @returns {{ totalCreated: number, totalUpdated: number }}
 */
export async function syncAllRounds(leagueIds) {
  console.log(`[Rounds] ▶ Sincronizando rounds de ${leagueIds.length} ligas...`);
  const startTime = Date.now();
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const leagueId of leagueIds) {
    try {
      const result = await syncRoundsForLeague(leagueId);
      totalCreated += result.created;
      totalUpdated += result.updated;

      if (result.total > 0) {
        console.log(`[Rounds]   ✓ Liga ${leagueId}: ${result.total} rounds (${result.created} nuevas, ${result.updated} actualizadas)`);
      }

      // Rate limit entre ligas
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[Rounds]   ✗ Error liga ${leagueId}:`, err.message);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Rounds] ✅ Sync completado en ${elapsed}s — +${totalCreated} nuevas, ~${totalUpdated} actualizadas`);

  return { totalCreated, totalUpdated };
}
