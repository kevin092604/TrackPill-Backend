require('dotenv').config();
const { pool } = require('../config/db');

/**
 * JOB que genera las dosis para un dia especifico o para hoy y manana.
 * Garantiza que cuando un usuario registre un medicamento, se generen
 * inmediatamente las dosis del dia actual y de manana sin esperar al cron de las 12am.
 * @author Jesús Zepeda
 * @version 0.3.0
 */
async function generateDailyDoses(targetDate = null) {
    console.info('[JOB] Iniciando proceso de generación diaria de dosis...');

    try {
        const datesToProcess = [];

        if (targetDate) {
            datesToProcess.push(new Date(targetDate));
        } else {
            // Primero obtenemos la hora real en Honduras
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Tegucigalpa',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            const parts = formatter.formatToParts(new Date());
            const p = {};
            parts.forEach(({ type, value }) => { p[type] = value; });
            // Creamos un objeto Date basado en Honduras y no en UTC
            const today = new Date(`${p.year}-${p.month}-${p.day}T00:00:00-06:00`);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            datesToProcess.push(today, tomorrow);
        }

        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let totalGeneratedCount = 0;

        for (const dateObj of datesToProcess) {
            const dateString = dateObj.toISOString().split('T')[0];
            const dayName = daysOfWeek[dateObj.getDay()];

            const activeMedicinesResult = await pool.query(
                `SELECT
                    m.id AS medicine_id,
                    m.start_time AS schedule_hour,
                    m.frequency
                 FROM medicine_stock.medicines m
                 JOIN medicine_stock.schedules s ON m.schedule_id = s.id
                 WHERE s.${dayName} = TRUE
                    AND (s.start_date IS NULL OR s.start_date <= $1)
                    AND (s.end_date IS NULL OR s.end_date >= $1)`,
                [dateString]
            );

            const medicines = activeMedicinesResult.rows;

            for (const med of medicines) {
                const scheduleTime = `${dateString}T${med.schedule_hour}-06:00`;

                const insertResult = await pool.query(
                    `INSERT INTO medicine_stock.medication_logs (medicine_id, scheduled_time, status_id)
                     VALUES ($1, $2, 1)
                     ON CONFLICT (medicine_id, scheduled_time) DO NOTHING
                     RETURNING id;`,
                    [med.medicine_id, scheduleTime]
                );

                if (insertResult.rows.length > 0) {
                    totalGeneratedCount++;
                }
            }
        }

        console.info(`[JOB] Proceso terminado con éxito. Dosis generadas: ${totalGeneratedCount}`);
    } catch (error) {
        console.error('[JOB] Error crítico durante la generación diaria de dosis:', error);
        throw error;
    }
}

if (require.main === module) {
    generateDailyDoses()
        .then(() => pool.end())
        .then(() => process.exit(0))
        .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = generateDailyDoses;