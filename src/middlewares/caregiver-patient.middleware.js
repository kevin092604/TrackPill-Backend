const CaregiverRelationship = require('../models/caregiver-relationship.model');
const { createHttpError } = require('../utils/helpers');

/**
 * Función que valida que exista una relación activa y aceptada entre el cuidador autenticado y el paciente solicitado
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/11
 * @date 2026/07/11
 * @param {Object} req Objeto de petición
 * @param {Object} res Objeto de respuesta
 * @param {Function} next Función de middleware
 * @returns {void}
 */
async function checkCaregiverPatientRelationship(req, res, next) {

    try {
        const caregiverId = req.user?.id;
        const { patientId } = req.params;

        if (!caregiverId) {
            throw createHttpError(401, 'Usuario no autenticado', 'unauthorized');
        }

        if (!patientId) {
            throw createHttpError(400, 'El ID del paciente es requerido.', 'patient_id_required');
        }

        const relationship = await CaregiverRelationship.findActiveRelation(caregiverId, patientId);

        if (!relationship) {
            throw createHttpError(
                403,
                'No tienes una relación activa y aceptada con este paciente.',
                'forbidden_relationship'
            );
        }

        req.relationship = relationship;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = {
    checkCaregiverPatientRelationship,
}