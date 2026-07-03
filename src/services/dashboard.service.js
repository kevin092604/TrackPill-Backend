
/**
 * Función que obtiene el resumen del dashboard para un paciente.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/02
 * @date 2026/07/02
 * @param {number} userId ID del paciente
 * @returns {Promise<Object>} Objeto con el resumen del dashboard
 */
async function getPatientSummary(userId) {

    //TODO (SCRUM-69): Reemplazar este mock con consultas SQL reales
    //para calcular dosis y adherencia del paciente con ID userId.

    //Respuesta mockeada temporal
    return {
        today: {
            scheduled: 4, //Total de dosis programadas para hoy
            completed: 2, //Dosis tomadas
            pending: 2, //Dosis pendientes
        },
        nextDose: {
            id: "100",
            medicationName: "Ibuprofeno 400mg",
            scheduledTime: "2026-07-02T08:00:00Z", //Hora de la siguiente dosis en formato ISO
            dose: "1 tableta", //Cantidad y unidad
        },
        weeklyAdherence: [
            { day: "Mon", scheduled: 3, completed: 3, percentage: 100 },
            { day: "Tue", scheduled: 3, completed: 2, percentage: 66.6 },
            { day: "Wed", scheduled: 4, completed: 4, percentage: 100 },
            { day: "Thu", scheduled: 4, completed: 2, percentage: 50 },
            { day: "Fri", scheduled: 3, completed: 3, percentage: 100 },
            { day: "Sat", scheduled: 2, completed: 2, percentage: 100 },
            { day: "Sun", scheduled: 2, completed: 1, percentage: 50 },
        ]
    }
}

module.exports = { getPatientSummary }