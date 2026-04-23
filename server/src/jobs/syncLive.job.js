/**
 * Cron Job: Sincronización en vivo de Sportmonks
 * Ejecuta cada 20 segundos — SÓLO si hay partidos en vivo o por empezar.
 * Optimizado para cuidar el rate limit: si no hay nada, no hace requests.
 *
 * Responsabilidades:
 * 1. Actualizar scores/estado de partidos en vivo → upsert en BD
 * 2. Emitir updates via Socket.io a los rooms de partidos
 * 3. Cuando un partido termina, sincronizar stats finales de jugadores
 * 4. Marcar como no-live los partidos que ya no están en el feed
 */
import cron from 'node-cron';
import prisma from '../config/database.js';
import { getLiveMatches, getFixtureWithPlayerStats } from '../services/sportmonks/sportmonksFixtures.js';
import { mapFixture, mapPlayerMatchStats, mapEvent } from '../utils/sportmonksMapper.js';
import { recalculateFixture } from './fantasyScoring.job.js';
import { logCronJob } from '../utils/cronLogger.js';
// Instancia de Socket.io — se setea desde fuera
let ioInstance = null;

// Circuit Breaker: pausa llamadas si Sportmonks falla 3+ veces seguidas
let consecutiveFailures = 0;
let circuitOpenUntil = null;
const CB_MAX_FAILURES = 3;
const CB_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Setter para la instancia de Socket.io.
 * @param {import('socket.io').Server} io
 */
export function setSocketIO(io) {
  ioInstance = io;
}

/**
 * Sincroniza stats finales de jugadores de un partido terminado.
 * Llamada una sola vez cuando el partido pasa a status 'finished'.
 * @param {number|string} smFixtureId - ID externo del fixture en Sportmonks
 * @param {string} internalFixtureId - ID interno del fixture en nuestra BD
 */
async function syncFinalPlayerStats(smFixtureId, internalFixtureId) {
  try {
    const data = await getFixtureWithPlayerStats(smFixtureId);
    const lineups = data?.data?.lineups || [];
    const events = data?.data?.events || [];

    let synced = 0;

    for (const lineupPlayer of lineups) {
      const stats = mapPlayerMatchStats(lineupPlayer, events);

      if (!stats.playerId) continue;

      try {
        await prisma.playerMatchStat.upsert({
          where: {
            fixtureId_playerId: {
              fixtureId: internalFixtureId,
              playerId: stats.playerId,
            },
          },
          update: {
            ...stats,
            updatedAt: new Date(),
          },
          create: {
            ...stats,
            fixtureId: internalFixtureId,
          },
        });
        synced++;
      } catch (err) {
        // Silenciar errores individuales de stats para no frenar el loop
        console.warn(`[Live] Stat upsert failed player ${stats.playerId}:`, err.message);
      }
    }

    // ── Persistir eventos del partido (goles, tarjetas, sustituciones) ──
    let eventsSynced = 0;
    for (const smEvent of events) {
      const mapped = mapEvent(smEvent);
      try {
        await prisma.fixtureEvent.create({
          data: {
            fixtureId: internalFixtureId,
            ...mapped,
          },
        });
        eventsSynced++;
      } catch (err) {
        // Duplicados u otros errores no deben frenar el proceso
      }
    }

    console.log(`[Sportmonks] ✓ Stats finales ${smFixtureId}: ${synced} jugadores, ${eventsSynced} eventos`);

    // Disparar cálculo de puntos fantasy automáticamente
    try {
      const result = await recalculateFixture(internalFixtureId);
      console.log(`[Fantasy] ⚡ Auto-scoring ${smFixtureId}: ${result.processedPlayers} jugadores, ${result.updatedTeams} equipos`);
    } catch (scoringErr) {
      console.error(`[Fantasy] ✗ Auto-scoring ${smFixtureId}: ${scoringErr.message}`);
    }
  } catch (err) {
    console.error(`[Sportmonks] ✗ Stats finales ${smFixtureId}: ${err.message}`);
  }
}

/**
 * Job principal de live sync.
 */
async function runLiveSync() {
  try {
    // --- Circuit Breaker: si el circuito está abierto, no llamar ---
    if (circuitOpenUntil && Date.now() < circuitOpenUntil) {
      return; // Silencio total durante el cooldown
    }
    if (circuitOpenUntil && Date.now() >= circuitOpenUntil) {
      // Cooldown terminó, cerrar circuito e intentar de nuevo
      circuitOpenUntil = null;
      consecutiveFailures = 0;
      // Circuit breaker cooldown ended — retry silently
    }

    // --- Verificación rápida: ¿hay algo que hacer? ---
    const now = new Date();

    // Contar partidos en vivo en la BD
    const liveCount = await prisma.fixture.count({
      where: { isLive: true, source: 'sportmonks' },
    });

    // Contar partidos que empiezan en los próximos 10 minutos
    const soonCount = await prisma.fixture.count({
      where: {
        status: 'scheduled',
        source: 'sportmonks',
        startTime: {
          gte: now,
          lte: new Date(now.getTime() + 10 * 60000),
        },
      },
    });

    // Si no hay partidos en vivo ni por empezar, no hacemos nada
    if (liveCount === 0 && soonCount === 0) return;

    // --- Hay partidos activos → llamar a la API ---
    const startTimeTracking = Date.now();
    const data = await getLiveMatches();
    const liveFixtures = data?.data || [];

    // Éxito → resetear circuit breaker
    consecutiveFailures = 0;

    const processedIds = [];

    for (const fixture of liveFixtures) {
      const mapped = mapFixture(fixture);
      const isFinished = mapped.status === 'finished';

      try {
        // Consultar el estado previo para no re-procesar (evitar bucle infinito si la API lo mantiene en inplay tras terminar)
        const previousState = await prisma.fixture.findUnique({
          where: { externalId_source: { externalId: mapped.externalId, source: 'sportmonks' } },
          select: { status: true },
        });

        // Upsert del fixture en BD
        const upserted = await prisma.fixture.upsert({
          where: {
            externalId_source: { externalId: mapped.externalId, source: 'sportmonks' },
          },
          update: {
            ...mapped,
            isLive: !isFinished,
          },
          create: {
            ...mapped,
            isLive: !isFinished,
          },
        });

        processedIds.push(mapped.externalId);

        // Emitir update via Socket.io
        if (ioInstance) {
          ioInstance.to(`match:${mapped.externalId}`).emit('match:update', {
            ...mapped,
            isLive: !isFinished,
            _updatedAt: new Date().toISOString(),
          });
        }

        // Si el partido recién terminó (antes no estaba finalizado o es nuevo pero ya finalizó en memoria caché/edge case)
        const justFinished = isFinished && (!previousState || previousState.status !== 'finished');

        if (justFinished) {
          // Marcar como no-live de manera redundante por seguridad
          await prisma.fixture.update({
            where: { id: upserted.id },
            data: { isLive: false },
          });

          // Sync stats finales en background (no bloquea el loop)
          syncFinalPlayerStats(fixture.id, upserted.id).catch(() => { });
        }
      } catch (err) {
        console.error(`[Live] Error procesando fixture ${mapped.externalId}:`, err.message);
      }
    }

    // --- Marcar como no-live los que ya no están en el feed ---
    if (processedIds.length > 0) {
      const staleCount = await prisma.fixture.updateMany({
        where: {
          isLive: true,
          source: 'sportmonks',
          externalId: { notIn: processedIds },
        },
        data: { isLive: false, status: 'finished' },
      });

      if (staleCount.count > 0) {
        console.log(`[Live] ✓ ${staleCount.count} partidos marcados como finalizados`);
      }

      const msg = `Sincronizados en vivo ${processedIds.length} partidos. Finalizados forzados: ${staleCount.count}`;
      await logCronJob('Sportmonks Live', 'runLiveSync', 'success', Date.now() - startTimeTracking, msg, { processed: processedIds.length });
    }

  } catch (err) {
    consecutiveFailures++;

    if (consecutiveFailures >= CB_MAX_FAILURES) {
      circuitOpenUntil = Date.now() + CB_COOLDOWN_MS;
      const msg = `Circuit breaker ABIERTO — ${consecutiveFailures} fallos. Pausando ${CB_COOLDOWN_MS / 60000}min.`;
      console.error(`[Live] ⚡ ${msg}`);
      await logCronJob('Sportmonks Live', 'runLiveSync', 'warning', 0, msg);
    } else if (!err.message?.includes('Rate limit')) {
      console.error(`[Live] ✗ Error (${consecutiveFailures}/${CB_MAX_FAILURES}): ${err.message}`);
      await logCronJob('Sportmonks Live', 'runLiveSync', 'error', 0, `Falló sync: ${err.message}`);
    }
  }
}

/**
 * Arranca el cron job de sync en vivo.
 * Ejecuta cada 20 segundos. Optimizado: no hace requests si no hay partidos activos.
 */
export function startLiveSyncJob() {
  cron.schedule('*/20 * * * * *', runLiveSync);
  console.log('  🔴 Live sync: cada 20s (condicional)');
}

// Exportar para ejecución manual/testing
export { runLiveSync };
