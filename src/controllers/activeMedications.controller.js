const activeMedicationsService = require('../services/activeMedications.service');

/**
 * Controlador que obtine las medicinas de un usuario
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/20
 * @date 2026/07/20
 * @param {Object} req Objeto de solicitud
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función next
 */
async function getActiveMedications(req, res, next) {
  try {
    const search = req.query.search || '';
    const medications = await activeMedicationsService.getActiveMedications(req.user.id, search);

    res.status(200).json({
      success: true,
      medications
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getActiveMedications
};