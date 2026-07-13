require('dotenv').config();
const { pool } = require('../config/db');

/**
 * JOB que detecta dosis retrasada y omitidas en base al tiempo transcurrido,
 * actualiza sus estados en la base de datos y genera notificaciones a cuidadores.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 */
async function checkOverdueDoses() {
    console.info('[JOB] Iniciando chequeo de dosis vencidas...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const overdueLogsResult = await client.query(`
            SELECT
                ml.id AS log_id,
                ml.scheduled_time,
                ml.status_id,
                m.id AS medicine_id,
                m.name AS medicine_name,
                m.user_id AS patient_id,
                u.first_name || ' ' || u.last_name AS patient_name
            FROM medicine_stock.medication_logs ml
            JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
            JOIN auth.users u ON m.user_id = u.id
            WHERE ml.status_id IN (1, 3) AND ml.scheduled_time < NOW()
        `);

        const logs = overdueLogsResult.rows;

        console.info(`[JOB] Se encontraron ${logs.length} dosis vencidas por evaluar.`);

        const now = new Date();

        for (const log of logs) {
            const scheduledTime = new Date(log.scheduled_time);
            const diffMinutes = (now - scheduledTime) / (1000 * 60);

            let newStatusId = null;
            let notificationType = null;
            let notificationMessage = null;

            if (diffMinutes > 30) {
                if (log.status_id !== 4) {
                    newStatusId = 4; //Omitida
                    notificationType = 'dosis_omitida';
                    notificationMessage = `El paciente ${log.patient_name} omitió tomar su dosis de ${log.medicine_name} programada para las ${scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}.`;

                }
            } else if (diffMinutes > 10) {
                if (log.status_id === 1) {
                    newStatusId = 3; // Retrasada
                    notificationType = 'dosis_retrasada';
                    notificationMessage = `El paciente ${log.patient_name} tiene un retraso en tomar su dosis de ${log.medicine_name} programada para las ${scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
                }
            }

            if (newStatusId) {
                await client.query(
                    `UPDATE medicine_stock.medication_logs
                     SET status_id = $1
                     WHERE id = $2`,
                     [newStatusId, log.log_id]
                );
                console.info(`[JOB] Dosis ID ${log.log_id} transicionada a estado ID ${newStatusId}`);

                const caregiversResult = await client.query(
                    `SELECT caregiver_id
                     FROM auth.caregiver_relationships
                     WHERE patient_id = $1 AND status = 'aceptada'
                     AND active = TRUE`,
                    [log.patient_id]
                );

                const caregivers = caregiversResult.rows;

                for (const caregiver of caregivers) {
                    const dupCheck = await client.query(
                        `SELECT id
                         FROM medicine_stock.notifications
                         WHERE user_id = $1
                            AND dose_id = $2
                            AND type = $3
                         LIMIT 1`,
                        [caregiver.caregiver_id, log.log_id, notificationType]
                    );

                    if (dupCheck.rows.length === 0) {
                        await client.query(
                            `INSERT INTO medicine_stock.notifications (
                                user_id,
                                type,
                                message,
                                patient_id,
                                medicine_id,
                                dose_id
                            )
                            VALUES ($1, $2, $3, $4, $5, $6)`,
                            [
                                caregiver.caregiver_id,
                                notificationType,
                                notificationMessage,
                                log.patient_id,
                                log.medicine_id,
                                log.log_id
                            ]
                        );
                        console.info(`[JOB] Notificación '${notificationType}' enviada al cuidador ID ${caregiver.caregiver_id}.`);
                    }
                }
            }
        }

        await client.query('COMMIT');
        console.info('[JOB] Transacción completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[JOB] Error crítico durante el proceso de detección de dosis vencidas:', error);
    } finally {
        client.release();
        console.info('[JOB] Conexión de base de datos cerrada.');
    }
}

if (require.main === module) {
    checkOverdueDoses()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = checkOverdueDoses;