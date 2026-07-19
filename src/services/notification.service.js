const notificationModel = require('../models/notification.model');

/**
 * Función que obtiene las notificaciones de un usuario desde la base de datos.
 * @author agblandin@unah.hn
 * @version 0.1.2
 * @since 2026/07/03
 * @date 2026/07/19
 * @param {number} userId ID del usuario autenticado
 * @returns {Promise<Object[]>} Arreglo con las notificaciones ordenadas
 */
async function getUserNotifications(userId) {
    
    const notifications = await notificationModel.findByUserId(userId);

    return notifications.map(notif => {
        
        let titleText = "Notificación";
        if (notif.type === 'medication_reminder') titleText = "Recordatorio";
        if (notif.type === 'caregiver_invitation') titleText = "Invitación";
        if (notif.type === 'low_inventory') titleText = "Alerta de inventario";

        const referencesObj = {};
        if (notif.medicineId) referencesObj.medicineId = notif.medicineId.toString();
        if (notif.patientId) referencesObj.patientId = notif.patientId.toString();
        if (notif.doseId) referencesObj.doseId = notif.doseId.toString();

        return {
            id: notif.id.toString(),
            type: notif.type,
            title: titleText,
            message: notif.message,
            isRead: notif.isRead,
            createdAt: new Date(notif.createdAt).getTime(), 
            references: Object.keys(referencesObj).length > 0 ? referencesObj : null
        };
    });
}

module.exports = {
    getUserNotifications,
};