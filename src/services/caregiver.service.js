const CaregiverRelationship = require('../models/caregiver-relationship.model');
const PatientModel = require('../models/patient.model'); 
const { createHttpError } = require('../utils/helpers');

/**
 * Obtiene el resumen médico de un paciente para su cuidador
 * @author agblandin@unah.hn
 * @version 0.1.1
 * @since 2026/07/12
 * @date 2026/07/19
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
  const [nextDoseData, recentActivityData, complianceData] = await Promise.all([
      PatientModel.getNextDose(patientId),
      PatientModel.getRecentActivity(patientId),
      PatientModel.getWeeklyCompliance(patientId)
  ]);

  const summary = {
    patientId: parseInt(patientId, 10),
    relationshipLabel: relationship.relationshipLabel,
    nextDose: nextDoseData ? {
      medicationName: nextDoseData.medication_name,
      scheduledTime: nextDoseData.scheduled_time, 
      status: "pending" 
    } : null,
    recentActivity: recentActivityData.map(log => ({
      medicationName: log.medication_name,
      takenAt: log.taken_time,
      status: log.status.toLowerCase()
    })),
    weeklyCompliance: complianceData
  };

  return summary;
}

/**
 * Obtiene la lista de medicamentos activos de un paciente
 * @author agblandin@unah.hn
 * @version 0.1.2
 * @since 2026/07/12
 * @date 2026/07/19
 * @param {string|number} caregiverId ID del cuidador que hace la solicitud
 * @param {string|number} patientId ID del paciente a consultar
 * @returns {Promise<Object>} Objeto con los datos del paciente y sus medicamentos
 */
async function getPatientMedicines(caregiverId, patientId) {
  
  const relationship = await CaregiverRelationship.findOpenBetween(caregiverId, patientId);
  if (!relationship || relationship.status !== 'aceptada' || !relationship.active) {
    throw createHttpError(403, 'No tienes permiso para ver los medicamentos de este paciente.');
  }

  const rawMedicines = await PatientModel.getPatientMedicines(patientId);
  
  const patientFirstName = rawMedicines.length > 0 ? rawMedicines[0].first_name : "Paciente";

  const formattedMedicines = rawMedicines.map(med => ({
      id: med.id,
      name: med.name,
      doseQuantity: parseFloat(med.dose_quantity),
      doseUnit: med.dose_unit,
      frequencyText: `cada ${med.frequency} ${med.frequency_unit.toLowerCase()}`,
      remainingStock: parseFloat(med.remaining_stock),
      stockUnit: med.dose_unit,
      status: "active"
  }));

  return {
    patientId: Number(patientId),
    patientName: patientFirstName,
    totalActive: formattedMedicines.length,
    medicines: formattedMedicines
  };
}

module.exports = {
  getPatientSummary,
  getPatientMedicines
};