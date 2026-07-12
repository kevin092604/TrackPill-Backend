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

/**
 * Obtiene la lista de medicamentos activos de un paciente
 * @author agblandin@unah.hn
 * @version 0.1.1
 * @since 2026/07/12
 * @param {string|number} patientId ID del paciente a consultar
 * @returns {Promise<Object>} Objeto con los datos del paciente y sus medicamentos
 */
async function getPatientMedicines(patientId) {
  // mock data
  const medicines = [
    {
      id: 101,
      name: "Losartán 50mg",
      doseQuantity: 1,
      doseUnit: "Tableta",
      frequencyText: "cada 24 horas",
      nextDoseTime: "7:00 a.m.",
      remainingStock: 18,
      stockUnit: "tabletas",
      status: "active"
    },
    {
      id: 102,
      name: "Omeprazol 20mg",
      doseQuantity: 1,
      doseUnit: "Cápsula",
      frequencyText: "cada 24 horas",
      nextDoseTime: "10:00 a.m.",
      remainingStock: 10,
      stockUnit: "tabletas",
      status: "active"
    }
  ];
  return {
    patientId: Number(patientId),
    patientName: "Angel",
    totalActive: medicines.length,
    medicines
  };
}

module.exports = {
  getPatientSummary,
  getPatientMedicines
};