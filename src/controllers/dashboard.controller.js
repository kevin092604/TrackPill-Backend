
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

        const summary = await dashboardService.getPatientSummary(userId);

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

module.exports = { getPatientSummary };