const db = require('../config/db');

/**
 * Función que mapea una fila de base de datos de la tabla notifications a un objeto de JavaScript Notification.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {object} row - Fila de base de datos de la tabla notifications.
 * @returns {object|null} Objeto Notification.
 */
function mapNotification(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        patientId: row.patient_id,
        medicineId: row.medicine_id,
        doseId: row.dose_id
    };
}

/**
 * Función que crea una nueva notificación en la base de datos.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {object} notification - Objeto Notification.
 * @param {object} client - Cliente de base de datos.
 * @returns {object|null} Objeto Notification.
 */
async function create(notification, client = db) {
    const result = await client.query(
        `
        INSERT INTO medicine_stock.notifications (
            user_id,
            type,
            message,
            is_read,
            created_at,
            patient_id,
            medicine_id,
            dose_id
        )
        VALUES ($1, $2, $3, FALSE, NOW(), $4, $5, $6)
        RETURNING *
        `,
        [
            notification.userId,
            notification.type,
            notification.message,
            notification.patientId || null,
            notification.medicineId || null,
            notification.doseId || null
        ]
    );

    return mapNotification(result.rows[0]);
}

module.exports = {
    create,
    mapNotification,
};