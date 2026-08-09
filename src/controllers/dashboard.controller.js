
const dashboardService = require('../services/dashboard.service');

/**
 * Controlador que maneja la solicitud para obtener el resumen del dashboard de un paciente
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/02
 * @date 2026/07/02
 * @param {Object} req Objeto de solicitud
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función next
 */
async function getPatientSummary(req, res, next) {
    try {
        const userId = req.user.id;
        const timezone = req.headers['x-timezone'] || req.query.timezone || 'America/Tegucigalpa';

        const summary = await dashboardService.getPatientSummary(userId, timezone);

        res.status(200).json(
            {
                success: true,
                summary,
            }
        );
    } catch (error) {
        next(error);
    }
}

/**
 * Controlador que maneja la solicitud para obtener el resumen de seguimiento de los pacientes de un cuidador.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/03
 * @date 2026/07/03
 * @param {Object} req Objeto de solicitud
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función next
 */
async function getCaregiverSummary(req, res, next) {
    try {
        const caregiverId = req.user.id;
        const timezone = req.headers['x-timezone'] || req.query.timezone || 'America/Tegucigalpa';

        const patients = await dashboardService.getCaregiverSummary(caregiverId, timezone);

        res.status(200).json(
            {
                success: true,
                patients,
            }
        );
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getPatientSummary,
    getCaregiverSummary,
};