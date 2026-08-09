require('dotenv').config();
const { pool } = require('../config/db');

/**
 * JOB que detecta medicamentos con stock bajo,
 * actualiza sus estados en la base de datos y genera notificaciones al paciente y cuidadores.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/13
 * @date 2026/07/13
 */
async function checkLowStock() {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const lowStockResult = await client.query(`
            SELECT 
                m.id AS medicine_id,
                m.name AS medicine_name,
                m.user_id AS patient_id,
                u.first_name || ' ' || u.last_name AS patient_name,
                ARRAY_AGG(cr.caregiver_id) FILTER (WHERE cr.caregiver_id IS NOT NULL) AS caregiver_ids
            FROM medicine_stock.medicines m
            JOIN auth.users u ON m.user_id = u.id
            LEFT JOIN auth.caregiver_relationships cr 
                ON m.user_id = cr.patient_id AND cr.status = 'aceptada' AND cr.active = TRUE
            WHERE m.current_stock <= m.low_stock_threshold
              AND m.low_stock_alert_sent = FALSE
            GROUP BY m.id, u.id
        `);

        const alerts = lowStockResult.rows;
        console.info(`[JOB] Se encontraron ${alerts.length} medicamentos con stock crítico por evaluar.`);

        if (alerts.length === 0) {
            console.info(`[JOB] No hay alertas de stock bajo que generar. Finalizando.`);
            await client.query('ROLLBACK');
            return;
        }

        let notificationsGenerated = 0;

        for (const alert of alerts) {

            // Mismo tipo 'low_inventory' que usa inventory.service.js (SCRUM-90)
            // para que el frontend no tenga que mapear dos taxonomias distintas
            // para la misma alerta.
            const patientMessage = `Tu inventario de ${alert.medicine_name} está bajo. Quedan pocas dosis.`;
            await client.query(
                `INSERT INTO medicine_stock.notifications (user_id, type, message, patient_id, medicine_id)
                 VALUES ($1, 'low_inventory', $2, NULL, $3)`,
                [alert.patient_id, patientMessage, alert.medicine_id]
            );
            notificationsGenerated++;

            const caregivers = alert.caregiver_ids || [];
            if (caregivers.length > 0) {
                const caregiverMessage = `El inventario de ${alert.medicine_name} para ${alert.patient_name} está llegando a un nivel crítico.`;
                for (const caregiverId of caregivers) {
                    await client.query(
                        `INSERT INTO medicine_stock.notifications (user_id, type, message, patient_id, medicine_id)
                         VALUES ($1, 'low_inventory', $2, $3, $4)`,
                        [caregiverId, caregiverMessage, alert.patient_id, alert.medicine_id]
                    );
                    notificationsGenerated++;
                }
            }

            await client.query(
                `UPDATE medicine_stock.medicines SET low_stock_alert_sent = TRUE WHERE id = $1`,
                [alert.medicine_id]
            );
        }

        await client.query('COMMIT');
        console.info(`[JOB] Proceso terminado con éxito. Notificaciones generadas: ${notificationsGenerated}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[JOB] Error crítico durante el proceso de detección de stock bajo:', error);
    } finally {
        client.release();
        console.info('[JOB] Conexión de base de datos cerrada.');
    }
}

if (require.main === module) {
    checkLowStock()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = checkLowStock;