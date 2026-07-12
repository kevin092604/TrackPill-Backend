const { createHttpError } = require('../utils/helpers');

/**
 * Función que permite al cuidador autenticado obtener el calendario del paciente al que está asignado
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/11
 * @date 2026/07/11
 * @param {Object} req Objeto de petición
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función de middleware
 * @returns {void}
 */
async function getPatientCalendar(req, res, next) {
    try {
        const { month } = req.query;
        const { patientId } = req.params;

        // Valida que el mes sea correcto
        if (month && !/^\d{4}-\d{2}$/.test(month)) {
            throw createHttpError(
                400,
                'El formato del parámetro month debe ser YYYY-MM.',
                'invalid_month_format'
            );
        }

        // TODO: Implementar el calendario
        // Mientras no se implemente el calendario, se devuelve una respuesta vacía
        res.status(200).json(
            {
                success: true,
                data: {
                    patientId: Number(patientId),
                    month: month || new Date().toISOString().slice(0, 7),
                    events: []
                }
            }
        );
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getPatientCalendar,
};