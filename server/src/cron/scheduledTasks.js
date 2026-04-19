import cron from 'node-cron';
import { scorePendingPredictions } from '../services/scoring.service.js';

export function setupCronJobs() {
  // Ejecutar en horarios clave (17, 19, 22 y 01 hs) para reducir llamadas a la API
  cron.schedule('0 1,17,19,22 * * *', async () => {
    console.log(`[CRON] Iniciando cálculo de puntajes (batch)... ${new Date().toISOString()}`);
    
    try {
      const result = await scorePendingPredictions();
      console.log(`[CRON] Cálculo completado: ${result.message}`);
    } catch (err) {
      console.error('[CRON] Error al calcular puntajes:', err);
    }
  });

  console.log('✅ Cron jobs configurados — scoring a las 17:00, 19:00, 22:00 y 01:00 hs.');
}
