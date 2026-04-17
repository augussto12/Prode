import cron from 'node-cron';
import { scorePendingPredictions } from '../services/scoring.service.js';

export function setupCronJobs() {
  // Ejecutar cada 2 horas para que los puntos se actualicen rápido después de cada partido
  // Horarios: 00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
  cron.schedule('0 */2 * * *', async () => {
    console.log(`[CRON] Iniciando cálculo de puntajes (batch)... ${new Date().toISOString()}`);
    
    try {
      const result = await scorePendingPredictions();
      console.log(`[CRON] Cálculo completado: ${result.message}`);
    } catch (err) {
      console.error('[CRON] Error al calcular puntajes:', err);
    }
  });

  console.log('✅ Cron jobs configurados — scoring cada 2 horas.');
}
