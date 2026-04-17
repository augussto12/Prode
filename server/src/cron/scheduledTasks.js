import cron from 'node-cron';
import { scorePendingPredictions } from '../services/scoring.service.js';

export function setupCronJobs() {
  // Ejecutar todos los días a las 00:00 AM y a las 06:00 AM
  cron.schedule('0 0,6 * * *', async () => {
    console.log('[CRON] Iniciando cálculo de puntajes (batch)...');
    
    try {
      const result = await scorePendingPredictions();
      console.log(`[CRON] Calculo completado: ${result.message}`);
    } catch (err) {
      console.error('[CRON] Error calcular puntajes:', err);
    }
  });

  console.log('✅ Cron jobs configurados correctamente.');
}
