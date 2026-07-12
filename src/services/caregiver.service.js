const CaregiverRelationship = require('../models/caregiver-relationship.model');
const { createHttpError } = require('../utils/helpers');

/**
 * Obtiene el resumen médico de un paciente para su cuidador
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/12
 * @param {string|number} caregiverId ID del cuidador (usuario logueado)
 * @param {string|number} patientId ID del paciente a consultar
 * @returns {Promise<Object>} Resumen del paciente
 */
async function getPatientSummary(caregiverId, patientId) {

  const relationship = await CaregiverRelationship.findOpenBetween(caregiverId, patientId);

  if (!relationship || relationship.status !== 'aceptada') {
    throw createHttpError(403, 'No tienes acceso a la información de este paciente.', 'forbidden_patient_access');
  }

  if (!relationship.active) {
     throw createHttpError(403, 'El vínculo con este paciente se encuentra pausado.', 'paused_relationship');
  }

  // mock data
  const summary = {
    patientId: parseInt(patientId, 10),
    relationshipLabel: relationship.relationshipLabel,
    nextDose: {
      medicationName: "Amoxicilina 500mg",
      scheduledTime: "14:00",
      status: "pending"
    },
    recentActivity: [
      { medicationName: "Losartán 50mg", takenAt: "2026-07-12T08:05:00Z", status: "taken" },
      { medicationName: "Vitamina C", takenAt: "2026-07-11T20:00:00Z", status: "taken" }
    ],
    weeklyCompliance: {
      percentage: 85,
      dosesTaken: 12,
      totalDoses: 14
    }
  };
  return summary;
}

module.exports = {
  getPatientSummary
};