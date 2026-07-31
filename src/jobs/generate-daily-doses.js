require('dotenv').config();
const { pool } = require('../config/db');

/**
 * JOB que se encarga de generar las dosis para el diarias (24 horas antes del momento de ejecución)
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/07/03
 * @date 2026/07/12
 */
async function generateDailyDoses() {

    console.info('[JOB] Iniciando proceso de generación diaria de dosis...');

    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDateString = tomorrow.toISOString().split('T')[0];

        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const tomorrowDayName = daysOfWeek[tomorrow.getDay()];

        const activeMedicinesResult = await pool.query(
            `SELECT
                m.id AS medicine_id,
                m.start_time AS schedule_hour
             FROM medicine_stock.medicines m
             JOIN medicine_stock.schedules s ON m.schedule_id = s.id
             WHERE s.${tomorrowDayName} = TRUE
                AND (s.start_date IS NULL OR s.start_date <= $1)
                AND (s.end_date IS NULL OR s.end_date >= $1)`,
            [tomorrowDateString]
        );

        const medicines = activeMedicinesResult.rows;
        console.info(`[JOB] Se encontraron ${medicines.length} medicamentos activos para mañana (${tomorrowDayName}).`);

        if (medicines.length === 0) {
            console.info(`[JOB] No hay dosis que generar para mañana. Finalizando.`);
            return;
        }

        let generatedCount = 0;

        for (const med of medicines) {
            const scheduleTime = `${tomorrowDateString}T${med.schedule_hour}`;

            const insertResult = await pool.query(
                `INSERT INTO medicine_stock.medication_logs (medicine_id, scheduled_time, status_id)
                 VALUES ($1, $2, 1)
                 ON CONFLICT (medicine_id, scheduled_time) DO NOTHING
                 RETURNING id;`,
                [med.medicine_id, scheduleTime]
            );

            if (insertResult.rows.length > 0) {
                generatedCount++;
            }
        }

        console.info(`[JOB] Proceso terminado con éxito. Dosis generadas: ${generatedCount}`);
    } catch (error) {
        console.error('[JOB] Error crítico durante la generación diaria de dosis:', error);
        throw error;
    }
}

if (require.main === module) {
    // Solo se cierra el pool compartido cuando el job corre como script
    // independiente (node src/jobs/generate-daily-doses.js). Si se cerrara
    // dentro de generateDailyDoses(), un scheduler que lo invoque desde el
    // proceso del servidor dejaria sin conexion a toda la API despues de la
    // primera ejecucion.
    generateDailyDoses()
        .then(() => pool.end())
        .then(() => process.exit(0))
        .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = generateDailyDoses;