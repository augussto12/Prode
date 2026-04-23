import prisma from '../config/database.js';

/**
 * Guarda el resultado de un proceso Cron en la base de datos
 * @param {string} module - 'Sportmonks', 'Fantasy Scoring', 'GranDT Transf', 'System'
 * @param {string} jobName - Nombre puntual de la tarea (ej. 'syncFixtures')
 * @param {string} status - 'success', 'error', 'warning'
 * @param {number} durationMs - Duración del job
 * @param {string} message - Un string descriptivo sobre qué fue modificado o qué resultó
 * @param {object} metadata - Extra datos útiles en formato JSON (opcional)
 */
export async function logCronJob(module, jobName, status, durationMs, message, metadata = null) {
  try {
    await prisma.cronJobLog.create({
      data: {
        module,
        jobName,
        status,
        durationMs: Math.round(durationMs),
        message,
        metadata: metadata ? metadata : undefined
      }
    });
  } catch (error) {
    // Si falla el logger, solo disparamos log a consola para que no rompa el flujo principal
    console.error(`[CronLogger Error] Falló al guardar log para ${jobName}:`, error.message);
  }
}
