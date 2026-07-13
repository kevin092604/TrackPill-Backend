const notificationService = require('../services/notification.service');
const {createHttpError} = require('../utils/helpers')

/**
 * Controlador que maneja la solicitud para obtener las notificaciones del usuario.
 * @author Angel Blandin
 * @version 0.1.0
 * @since 2026/07/03
 * @date 2026/07/03
 * @param {Object} req Objeto de solicitud
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función next
 */
async function getNotifications(req, res, next) {
    try {
        const userId = req?.user?.id || null ;
        if (!userId) {
            throw createHttpError(401, 'Falta el ID de usuario.', 'unauthorized');
        }
        const notifications = await notificationService.getUserNotifications(userId);

        res.status(200).json(
            {
                success: true,
                notifications,
            }
        );
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getNotifications,
};