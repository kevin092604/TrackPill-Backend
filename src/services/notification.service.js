/**
 * Función que obtiene las notificaciones de un usuario.
 * @author agblandin@unah.hn
 * @version 0.1.1
 * @since 2026/07/03
 * @date 2026/07/03
 * @param {number} userId ID del usuario autenticado
 * @returns {Promise<Object[]>} Arreglo con las notificaciones ordenadas
 */
async function getUserNotifications(userId) {

    const now = Date.now();

    // Respuesta tenporal
    return [
        {
            id: "1",
            type: "medication_reminder",
            title: "Recordatorio",
            message: "Es hora de tu dosis de Omeprazole 20mg",
            details: "Horario 14:30",
            isRead: false, 
            createdAt: now,
            references: {
                medicineId: "15",
                scheduleId: "42"
            }
        },
        {
            id: "2",
            type: "caregiver_invitation",
            title: "Invitación",
            message: "BLandin te invitó a formar parte de su círculo de cuidadores",
            details: null, 
            isRead: false, 
            createdAt: now,
            references: {
                invitationId: "8",
                patientId: "2"
            }
        },
        {
            id: "3",
            type: "low_inventory",
            title: "Alerta de inventario",
            message: "Paracetamol 500mg tiene stock bajo",
            details: "Solo 5 unidades restantes",
            isRead: false, 
            createdAt: now,
            references: {
                medicineId: "10"
            }
        },
        {
            id: "4",
            type: "medication_reminder",
            title: "Recordatorio",
            message: "Es hora de tu dosis de Omeprazole 20mg",
            details: "Horario 14:30",
            isRead: true, 
            createdAt: now,
            references: {
                medicineId: "15",
                scheduleId: "41"
            }
        },
        
    ];
}

module.exports = {
    getUserNotifications,
};