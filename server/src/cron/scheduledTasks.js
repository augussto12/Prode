import cron from 'node-cron';
import { scorePendingPredictions, reverifyRecentResults } from '../services/scoring.service.js';
import { calculateReadyOutrightScores } from '../services/outrights.service.js';
import { logCronJob } from '../utils/cronLogger.js';

const PRODE_CRON_OPTIONS = { timezone: 'America/Argentina/Buenos_Aires' };
let scoringRunning = false;
let reverifyRunning = false;
let outrightsRunning = false;

async function runReverifyJob() {
  if (reverifyRunning) {
    await logCronJob('Prode', 'reverifyResults', 'warning', 0, 'Reverificacion omitida: ya habia una ejecucion en curso');
    return;
  }

  reverifyRunning = true;
  const start = Date.now();

  try {
    const result = await reverifyRecentResults();
    await logCronJob(
      'Prode',
      'reverifyResults',
      'success',
      Date.now() - start,
      `Verificados ${result.checked} fixtures, ${result.reset} reseteados, ${result.corrected} corregidos`,
    );
  } catch (err) {
    await logCronJob('Prode', 'reverifyResults', 'error', Date.now() - start, err.message);
  } finally {
    reverifyRunning = false;
  }
}

async function runScoringJob() {
  if (scoringRunning) {
    await logCronJob('Prode', 'scorePendingPredictions', 'warning', 0, 'Scoring omitido: ya habia una ejecucion en curso');
    return;
  }

  scoringRunning = true;
  const start = Date.now();

  try {
    const result = await scorePendingPredictions();
    await logCronJob('Prode', 'scorePendingPredictions', 'success', Date.now() - start, result.message);
  } catch (err) {
    await logCronJob('Prode', 'scorePendingPredictions', 'error', Date.now() - start, err.message);
    console.error('[Cron Prode] Error:', err.message);
  } finally {
    scoringRunning = false;
  }
}

async function runOutrightsJob() {
  if (outrightsRunning) {
    await logCronJob('Prode', 'calculateReadyOutrights', 'warning', 0, 'Premios finales omitidos: ya habia una ejecucion en curso');
    return;
  }

  outrightsRunning = true;
  const start = Date.now();

  try {
    const result = await calculateReadyOutrightScores();
    await logCronJob(
      'Prode',
      'calculateReadyOutrights',
      'success',
      Date.now() - start,
      `Revisados ${result.checked} resultados finales, ${result.calculated} calculados`,
      { errors: result.errors },
    );
  } catch (err) {
    await logCronJob('Prode', 'calculateReadyOutrights', 'error', Date.now() - start, err.message);
  } finally {
    outrightsRunning = false;
  }
}

export function setupCronJobs() {
  cron.schedule('0 1 * * *', async () => {
    await runReverifyJob();
    await runScoringJob();
    await runOutrightsJob();
  }, PRODE_CRON_OPTIONS);

  cron.schedule('0 17,19,22,2 * * *', async () => {
    await runScoringJob();
    await runOutrightsJob();
  }, PRODE_CRON_OPTIONS);

  console.log(
    'Cron Prode configurado - timezone America/Argentina/Buenos_Aires; scoring a las 17, 19, 22, 01 y 02hs (01hs incluye reverificacion)',
  );
}
