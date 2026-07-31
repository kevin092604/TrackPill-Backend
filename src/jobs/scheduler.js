const cron = require('node-cron');

const generateDailyDoses = require('./generate-daily-doses');
const checkOverdueDoses = require('./check-overdue-doses');
const checkLowStock = require('./checkLowStock');

/**
 * Registra los jobs periodicos del sistema de dosis dentro del proceso del
 * servidor. Antes de esto, generate-daily-doses.js, check-overdue-doses.js
 * y checkLowStock.js solo se ejecutaban si alguien los corria manualmente
 * (node src/jobs/...), por lo que nunca se generaban dosis ni alertas en
 * producción.
 */
function startScheduledJobs() {
  // 00:05 todos los dias: genera las dosis del dia siguiente.
  cron.schedule('5 0 * * *', () => {
    generateDailyDoses().catch((error) => {
      console.error('[SCHEDULER] Fallo generateDailyDoses:', error.message);
    });
  });

  // Cada 10 minutos: detecta dosis retrasadas/omitidas y notifica a cuidadores.
  cron.schedule('*/10 * * * *', () => {
    checkOverdueDoses().catch((error) => {
      console.error('[SCHEDULER] Fallo checkOverdueDoses:', error.message);
    });
  });

  // Cada hora: respaldo de deteccion de stock bajo (el chequeo principal
  // ocurre en tiempo real via inventory.service.js al registrar un
  // movimiento de stock).
  cron.schedule('0 * * * *', () => {
    checkLowStock().catch((error) => {
      console.error('[SCHEDULER] Fallo checkLowStock:', error.message);
    });
  });

  console.info('[SCHEDULER] Jobs de dosis y stock programados.');
}

module.exports = { startScheduledJobs };
