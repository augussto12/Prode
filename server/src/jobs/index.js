/**
 * Inicialización de todos los Cron Jobs de Sportmonks.
 * Se llama desde server.js después de inicializar Socket.io.
 */
// [OCULTADO] Jobs de Sportmonks y Fantasy — No se usan por ahora
// import { startStaticSyncJob } from './syncStatic.job.js';
// import { startFixturesSyncJob } from './syncFixtures.job.js';
// import { startLiveSyncJob, setSocketIO } from './syncLive.job.js';
// import { startFantasyScoringJob } from './fantasyScoring.job.js';
// import { startFantasyGameweekJob } from './fantasyGameweek.job.js';

/**
 * Inicializa todos los cron jobs de Sportmonks.
 * @param {import('socket.io').Server} io - Instancia de Socket.io
 */
export function initializeSportmonksJobs(io) {
  console.log('[Cron] Jobs Sportmonks + Fantasy desactivados.');
  // [OCULTADO] Todo el contenido de inicialización de jobs
  // if (io) { setSocketIO(io); }
  // startStaticSyncJob();
  // startFixturesSyncJob();
  // startLiveSyncJob();
  // startFantasyScoringJob();
  // startFantasyGameweekJob(io);
}
