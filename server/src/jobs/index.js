/**
 * Inicialización de todos los Cron Jobs de Sportmonks.
 * Se llama desde server.js después de inicializar Socket.io.
 */
import { startStaticSyncJob } from './syncStatic.job.js';
import { startFixturesSyncJob } from './syncFixtures.job.js';
import { startLiveSyncJob, setSocketIO } from './syncLive.job.js';
import { startFantasyScoringJob } from './fantasyScoring.job.js';
import { startFantasyGameweekJob } from './fantasyGameweek.job.js';

/**
 * Inicializa todos los cron jobs de Sportmonks.
 * @param {import('socket.io').Server} io - Instancia de Socket.io
 */
export function initializeSportmonksJobs(io) {
  console.log('[Cron] Inicializando jobs Sportmonks + Fantasy...');

  // Pasar Socket.io al job de live sync
  if (io) {
    setSocketIO(io);
  }

  // Arrancar los tres crons base
  startStaticSyncJob();
  startFixturesSyncJob();
  startLiveSyncJob();

  // Arrancar crons de Fantasy
  startFantasyScoringJob();
  startFantasyGameweekJob(io);

  console.log('[Cron] ✓ Todos los jobs inicializados');
}
