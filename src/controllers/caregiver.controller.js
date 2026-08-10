const { createHttpError } = require('../utils/helpers');
const caregiverService = require('../services/caregiver.service');

/**
 * Función que permite al cuidador autenticado obtener el calendario del paciente al que está asignado
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/07/11
 * @date 2026/07/31
 * @param {Object} req Objeto de petición
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función de middleware
 * @returns {void}
 */
async function getPatientCalendar(req, res, next) {
    try {
        const { month } = req.query;
        const { patientId } = req.params;
        const timezone = req.headers['x-timezone'] || req.query.timezone || 'America/Tegucigalpa';

        // Valida que el mes sea correcto
        if (month && !/^\d{4}-\d{2}$/.test(month)) {
            throw createHttpError(
                400,
                'El formato del parámetro month debe ser YYYY-MM.',
                'invalid_month_format'
            );
        }

        const data = await caregiverService.getPatientCalendar(req.user.id, patientId, month, timezone);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Función que permite obtener el detalle diario de dosis y tomas de un paciente.
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/07/12
 * @date 2026/07/31
 * @param {Object} req Objeto de petición
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función de middleware
 * @returns {void}
 */
async function getPatientDoses(req, res, next) {
    try {
        const { date } = req.query;
        const { patientId } = req.params;
        const timezone = req.headers['x-timezone'] || req.query.timezone || 'America/Tegucigalpa';

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw createHttpError(
                400,
                'El formato del parámetro date debe ser YYYY-MM-DD.',
                'invalid_date_format'
            );
        }

        const data = await caregiverService.getPatientDoses(req.user.id, patientId, date, timezone);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Controlador para obtener el resumen del paciente
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 */
async function getPatientSummary(req, res, next) {
  try {
    const caregiverId = req?.user?.id;
    const patientId = req.params.patientId;

    if (!caregiverId) {
      throw createHttpError(401, 'Usuario no autenticado.', 'unauthorized');
    }

    if (!patientId) {
       throw createHttpError(400, 'El ID del paciente es requerido.', 'missing_patient_id');
    }

    const data = await caregiverService.getPatientSummary(caregiverId, patientId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para obtener la lista de medicamentos del paciente
 * @author agblandin@unah.hn
 * @version 0.1.2
 * @since 2026/07/12
 * @date 2026/07/31
 * @param {Object} req Objeto de petición
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función de middleware
 */
async function getPatientMedicines(req, res, next) {
    try {
        const { patientId } = req.params;
        const { search } = req.query;

        const data = await caregiverService.getPatientMedicines(req.user.id, patientId, search || '');

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getPatientCalendar,
    getPatientDoses,
    getPatientSummary,
    getPatientMedicines
};
