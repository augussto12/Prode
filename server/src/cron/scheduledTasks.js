import cron from 'node-cron';
import { scorePendingPredictions, reverifyRecentResults } from '../services/scoring.service.js';
import { logCronJob } from '../utils/cronLogger.js';

export function setupCronJobs() {
  // Ciclo 01:00 AM — reverificación + scoring
  cron.schedule('0 1 * * *', async () => {
    // Paso 1: Re-verificar resultados recientes (últimas 24hs)
    const reverifyStart = Date.now();
    try {
      const reverifyResult = await reverifyRecentResults();
      await logCronJob('Prode', 'reverifyResults', 'success', Date.now() - reverifyStart,
        `Verificados ${reverifyResult.checked} fixtures, ${reverifyResult.reset} reseteados`
      );
    } catch (err) {
      await logCronJob('Prode', 'reverifyResults', 'error', Date.now() - reverifyStart, err.message);
    }

    // Paso 2: Scoring normal
    const scoreStart = Date.now();
    try {
      const result = await scorePendingPredictions();
      await logCronJob('Prode', 'scorePendingPredictions', 'success', Date.now() - scoreStart, result.message);
    } catch (err) {
      await logCronJob('Prode', 'scorePendingPredictions', 'error', Date.now() - scoreStart, err.message);
      console.error('[Cron Prode] ✗ Error:', err.message);
    }
  });

  // Ciclos 17, 19, 22 hs — solo scoring (sin reverificación)
  cron.schedule('0 17,19,22 * * *', async () => {
    const start = Date.now();
    try {
      const result = await scorePendingPredictions();
      await logCronJob('Prode', 'scorePendingPredictions', 'success', Date.now() - start, result.message);
    } catch (err) {
      await logCronJob('Prode', 'scorePendingPredictions', 'error', Date.now() - start, err.message);
      console.error('[Cron Prode] ✗ Error:', err.message);
    }
  });

  console.log('✅ Cron Prode configurado — scoring a las 17, 19, 22 y 01hs (01hs incluye reverificación)');
}
