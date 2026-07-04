require('dotenv').config();
const { pool } = require('../config/db');

/**
 * JOB que se encarga de generar las dosis para el diarias (24 horas antes del momento de ejecución)
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/03
 * @date 2026/07/03
 */
async function generateDailyDoses() {

    console.info('[JOB] Iniciando proceso de generación diaria de dosis...');

    try {
        //Obtener todos los horarios de dosis activos de medicamentos activos
        //Nota: Esta consulta asume una estructura estándar en la base de datos
        //Está sujeta a cambios pero lo que se pretende es tener una lista de horarios de dosis que deben ser generados

        const activeSchedulesResult = await pool.query(`
            SELECT
                ds.id AS dose_schedule_id,
                ds.hour AS schedule_hour
            FROM dose_schedules ds
            JOIN medications m ON ds.medication_id = m.id
            WHERE ds.active = TRUE AND m.active = TRUE;  
        `);

        const schedules = activeSchedulesResult.rows;

        console.info(`[JOB] Se encontraron ${schedules.length} horarios de dosis activos.`);

        if (schedules.length === 0) {
        
            console.info('[JOB] No hay dosis que generar. Finalizando.');
            return;
        }

        //Calcular la fecha del día siguiente en formato YYYY-MM-DD
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDateString = tomorrow.toISOString().split('T')[0];

        let generatedCount = 0;

        //Generar la dosis para cada horario de toma correspondiente a mañana
        for (const schedule of schedules) {
            //Combinar la fecha de "mañana" con la hora programada del medicamento
            const scheduleTime = `${tomorrowDateString}T${schedule.schedule_hour}`;

            //Insertar la dosis en estado 'pending'
            //Usar ON CONFLICT para evitar duplicar dosis si el script se ejecuta dos veces por error
            const insertResult = await pool.query(`
                INSERT INTO doses (dose_schedule_id, schedule_time, status)
                VALUES ($1, $2, 'pending')
                ON CONFLICT (dose_schedule_id, schedule_time) DO NOTHING
                RETURNING id;
            `, [schedule.dose_schedule_id, scheduleTime]);

            if (insertResult.rows.length > 0) {
                generatedCount++;
            }
        }

        console.info(`[JOB] Proceso terminado con éxito. Dosis generadas: ${generatedCount}`);
    
    } catch (error) {
        
        console.error('[JOB] Error crítico durante la generación diaria de dosis:', error);
    } finally {
        //Cerrar la conexión a la base de datos
        await pool.end();
        console.info('[JOB] Conexión a la base de datos cerrada.');
    }
}

generateDailyDoses();