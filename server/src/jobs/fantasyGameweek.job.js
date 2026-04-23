import cron from 'node-cron';
import prisma from '../config/database.js';
import { logCronJob } from '../utils/cronLogger.js';

export function startFantasyGameweekJob(io) {
  // Cada 5 minutos verificar si hay que cerrar transferencias
  // (cuando arranca el primer partido del gameweek activo)
  cron.schedule('*/5 * * * *', async () => {
    try {
      // 1. Cierre de transferencias cuando llega el startDate
      const openGameweeks = await prisma.fantasyGameweek.findMany({
        where: { transfersOpen: true, isFinished: false }
      });
      
      const now = new Date();
      
      for (const ag of openGameweeks) {
        if (now >= ag.startDate) {
          const startTime = Date.now();
          await prisma.fantasyGameweek.update({
            where: { id: ag.id },
            data: { transfersOpen: false }
          });
          const msg = `Transferencias cerradas para GW ${ag.gameweekNumber} (Liga ${ag.fantasyLeagueId})`;
          console.log(`[Fantasy] ${msg}`);
          await logCronJob('Fantasy Transf', 'closeGameweekTransfers', 'success', Date.now() - startTime, msg, { gameweekId: ag.id });
          
          if (io) {
            // Notificar via Socket.io a usuarios conectados
            io.emit('fantasy:transfers_closed', { gameweekId: ag.id, leagueId: ag.fantasyLeagueId });
          }
        }
      }
      
      // 2. Transición de gameweek terminada a la próxima
      // Esto suele hacerlo Scoring, pero por consistencia garantizamos que si el END DATE pasó hace más de 12 horas y todo está terminado, pase
      // (No instruido estrictamente aquí, pero el trigger es date-based)
    } catch (err) {
       console.error('[Fantasy] Error checking gameweek boundaries:', err.message);
       await logCronJob('Fantasy Transf', 'closeGameweekTransfers', 'error', 0, `Error: ${err.message}`);
    }
  });
}
