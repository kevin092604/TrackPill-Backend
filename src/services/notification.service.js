'use strict';

const notificationModel = require('../models/notification.model');

/**
 * Obtiene todas las notificaciones de un usuario ordenadas por las más recientes.
 * El frontend espera el campo `title`; como la tabla no tiene columna title,
 * se genera automáticamente a partir del tipo de notificación.
 * @author TrackPill
 * @param {number|string} userId - ID del usuario autenticado.
 * @returns {Promise<object[]>} Arreglo de notificaciones formateadas para el cliente.
 */
async function getUserNotifications(userId) {
  const rows = await notificationModel.findByUserId(userId);

  return rows.map((notif) => ({
    id: notif.id,
    type: notif.type,
    title: buildTitle(notif.type),
    message: notif.message,
    isRead: notif.isRead,
    createdAt: notif.createdAt,
    references: {
      patientId: notif.patientId || null,
      medicineId: notif.medicineId || null,
      doseId: notif.doseId || null,
    },
  }));
}

/**
 * Genera un título legible a partir del tipo de notificación almacenado en BD.
 * @param {string} type - Tipo de notificación (ej. 'low_inventory').
 * @returns {string} Título en español.
 */
function buildTitle(type) {
  const titles = {
    medication_reminder: 'Recordatorio de medicamento',
    caregiver_invitation: 'Invitación de cuidador',
    low_inventory: 'Alerta de inventario bajo',
    dosis_retrasada: 'Dosis retrasada',
    dosis_omitida: 'Dosis omitida',
  };
  return titles[type] || 'Notificación';
}

module.exports = {
  getUserNotifications,
};
