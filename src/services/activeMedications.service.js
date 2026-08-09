const db  = require('../config/db');
const activeMedicationsModel = require('../models/activeMedications.model');

/**
 * Obtiene y formatea la lista de medicamentos activos.
 * @author agblandin@unah.hn
 * @since 2026/07/20
 * @date 2026/07/07
 * @param {Number} userId id del usuario 
 * @version 0.1.0
 */
async function getActiveMedications(userId, search = '') {
  const medicines = await activeMedicationsModel.findActiveMedications(userId, search);
  const formattedMedicines = [];

  for (const med of medicines) {
    const nextDoseResult = await db.query(
      `SELECT scheduled_time 
       FROM medicine_stock.medication_logs 
       WHERE medicine_id = $1 
         AND status_id IN (1, 3)
       ORDER BY scheduled_time ASC 
       LIMIT 1`,
      [med.id]
    );

    let nextDoseLabel = null;
    if (nextDoseResult.rows.length > 0) {
      const dateObj = new Date(nextDoseResult.rows[0].scheduled_time);
      nextDoseLabel = dateObj.toLocaleTimeString('es-HN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa',
      });
    } else if (med.startTime) {
      // Fallback para medicamentos recién creados que aún no tienen logs generados
      const [hours, minutes] = med.startTime.split(':');
      const dateObj = new Date();
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      nextDoseLabel = dateObj.toLocaleTimeString('es-HN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa',
      });
    }

    formattedMedicines.push({
      id: med.id,
      name: med.name,
      doseAmount: med.dose,
      doseUnit: med.doseUnit, 
      pharmaceuticalForm: med.pharmaceuticalForm,
      frequencyLabel: `cada ${med.frequency} ${med.timeUnit.toLowerCase()}`, 
      nextDoseLabel: nextDoseLabel,
      image: med.image
    });
  }

  return formattedMedicines;
}

module.exports = {
  getActiveMedications
};