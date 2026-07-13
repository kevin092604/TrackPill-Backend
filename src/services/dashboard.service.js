
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

    /* TODO (SCRUM-69): Reemplazar este mock con consultas SQL reales
    para calcular dosis y adherencia del paciente con ID userId. */

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

/**
 * Función que obtiene el resumen del dashboard para un cuidador.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/03
 * @date 2026/07/03
 * @param {number} caregiverId ID del cuidador
 * @returns {Promise<Object[]>} Objeto con el resumen del dashboard por paciente
 */
async function getCaregiverSummary(caregiverId) {
    
    /* TODO (SCRUM-69): Cuando se implemente la tabla de relación cuidador-paciente y dosis,
    reemplazar este mock con consultas SQL para obtener los pacientes en estado 'aceptado'
    y calcular su adherencia diaria en base a sus dosis. */

    //Respuesta mockeada temporal
    return [
        {
            id: "2",
            firstName: "Cesarín",
            lastName: "Cruz",
            email: "cesarin.cruz@trackpill.com",
            todayAdherence: {
                scheduled: 3, //Dosis programadas para hoy
                completed: 3, //Dosis tomadas
                pending: 0, //Dosis pedientes
                percentage: 100, //Porcentaje de adherencia
            }
        },
        {
            id: "3",
            firstName: "Ángel",
            lastName: "Blandito",
            email: "angel.blandito@trackpill.com",
            todayAdherence: {
                scheduled: 4, //Dosis programadas para hoy
                completed: 1, //Dosis tomadas
                pending: 3, //Dosis pedientes
                percentage: 25, //Porcentaje de adherencia
            }
        }
    ];
}

module.exports = {
    getPatientSummary,
    getCaregiverSummary,
};