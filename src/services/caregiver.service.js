const CaregiverRelationship = require('../models/caregiver-relationship.model');
const PatientModel = require('../models/patient.model');
const User = require('../models/user.model');
const db = require('../config/db');
const { createHttpError } = require('../utils/helpers');

async function assertActiveAcceptedRelationship(caregiverId, patientId) {
  // Un paciente consultando su propia informacion no necesita una relacion
  // de cuidador consigo mismo.
  if (String(caregiverId) === String(patientId)) {
    return { active: true, relationshipLabel: null, status: 'aceptada' };
  }

  const relationship = await CaregiverRelationship.findOpenBetween(caregiverId, patientId);

  if (!relationship || relationship.status !== 'aceptada') {
    throw createHttpError(403, 'No tienes acceso a la información de este paciente.', 'forbidden_patient_access');
  }
  if (!relationship.active) {
    throw createHttpError(403, 'El vínculo con este paciente se encuentra pausado.', 'paused_relationship');
  }

  return relationship;
}

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

  const [relationship, patientUser, nextDoseData, recentActivityData, complianceData, todayStats, criticalInv] = await Promise.all([
      assertActiveAcceptedRelationship(caregiverId, patientId),
      User.findById(patientId),
      PatientModel.getNextDose(patientId),
      PatientModel.getRecentActivity(patientId),
      PatientModel.getWeeklyCompliance(patientId),
      PatientModel.getTodayStats(patientId),
      PatientModel.getCriticalInventory(patientId),
  ]);

  const fullName = patientUser
    ? [patientUser.firstName, patientUser.lastName].filter(Boolean).join(' ')
    : 'Paciente';

  const summary = {
    patientId: parseInt(patientId, 10),
    patientName: fullName,
    patientPhotoUrl: patientUser?.photoUrl || null,
    relationshipLabel: relationship.relationshipLabel || 'Paciente',
    todayDoses: todayStats,
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
    criticalInventory: criticalInv,
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
async function getPatientMedicines(caregiverId, patientId, search = '') {
  await assertActiveAcceptedRelationship(caregiverId, patientId);

  const [rawMedicines, patientUser] = await Promise.all([
    PatientModel.getPatientMedicines(patientId, search),
    User.findById(patientId),
  ]);

  const patientFullName = patientUser
    ? [patientUser.firstName, patientUser.lastName].filter(Boolean).join(' ')
    : (rawMedicines.length > 0 ? rawMedicines[0].first_name : 'Paciente');

  const formattedMedicines = [];

  for (const med of rawMedicines) {
    const nextDoseResult = await db.query(
      `SELECT scheduled_time 
       FROM medicine_stock.medication_logs 
       WHERE medicine_id = $1 
         AND status_id IN (1, 3)
       ORDER BY scheduled_time ASC 
       LIMIT 1`,
      [med.id]
    );

    let nextDoseLabel = null;
    if (nextDoseResult.rows.length > 0) {
      const dateObj = new Date(nextDoseResult.rows[0].scheduled_time);
      nextDoseLabel = dateObj.toLocaleTimeString('es-HN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa',
      });
    } else if (med.start_time) {
      const [hours, minutes] = med.start_time.split(':');
      const dateObj = new Date();
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      nextDoseLabel = dateObj.toLocaleTimeString('es-HN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa',
      });
    }

    formattedMedicines.push({
      id: med.id,
      name: med.name,
      image: med.image,
      doseAmount: Number(med.dose_quantity),
      doseQuantity: Number(med.dose_quantity),
      doseUnit: med.dose_unit || 'mg',
      pharmaceuticalForm: med.pharmaceutical_form || 'Tableta',
      frequencyLabel: `cada ${med.frequency} ${med.frequency_unit ? med.frequency_unit.toLowerCase() : 'horas'}`,
      frequencyText: `cada ${med.frequency} ${med.frequency_unit ? med.frequency_unit.toLowerCase() : 'horas'}`,
      nextDoseLabel,
      remainingStock: Number(med.remaining_stock),
      stockUnit: med.dose_unit || 'tabletas',
      status: "active"
    });
  }

  return {
    patientId: Number(patientId),
    patientName: patientFullName,
    totalActive: formattedMedicines.length,
    medicines: formattedMedicines
  };
}

/**
 * Devuelve los dias del mes que tienen alguna dosis programada para el
 * paciente (SCRUM-85). Antes era un stub que siempre devolvia events: [].
 */
async function getPatientCalendar(caregiverId, patientId, month) {
  await assertActiveAcceptedRelationship(caregiverId, patientId);

  const resolvedMonth = month || new Date().toISOString().slice(0, 7);

  const [result, patientUser] = await Promise.all([
    db.query(
      `SELECT DISTINCT ml.scheduled_time::date AS day
       FROM medicine_stock.medication_logs ml
       JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
       WHERE m.user_id = $1
         AND to_char(ml.scheduled_time, 'YYYY-MM') = $2
       ORDER BY day ASC`,
      [patientId, resolvedMonth],
    ),
    User.findById(patientId),
  ]);

  const patientFullName = patientUser
    ? [patientUser.firstName, patientUser.lastName].filter(Boolean).join(' ')
    : 'Paciente';

  const events = result.rows.map((row) => ({
    date: new Date(row.day).toISOString().slice(0, 10),
  }));

  return {
    patientId: Number(patientId),
    patientName: patientFullName,
    month: resolvedMonth,
    events,
  };
}

/**
 * Devuelve las dosis programadas de un dia especifico para el paciente
 * (SCRUM-86).
 */
async function getPatientDoses(caregiverId, patientId, date) {
  await assertActiveAcceptedRelationship(caregiverId, patientId);

  const resolvedDate = date || new Date().toISOString().slice(0, 10);

  const [result, patientUser] = await Promise.all([
    db.query(
      `SELECT
          ml.id,
          ml.scheduled_time,
          m.id AS medicine_id,
          m.name AS medicine_name,
          m.image AS medicine_image,
          m.dose AS dose_quantity,
          mu.code AS dose_unit,
          pf.name AS pharmaceutical_form,
          ds.name AS status_name
       FROM medicine_stock.medication_logs ml
       JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
       JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
       LEFT JOIN medicine_stock.measurement_units mu ON pf.measurement_unit_id = mu.id
       JOIN medicine_stock.dose_status ds ON ml.status_id = ds.id
       WHERE m.user_id = $1
         AND ml.scheduled_time::date = $2::date
       ORDER BY ml.scheduled_time ASC`,
      [patientId, resolvedDate],
    ),
    User.findById(patientId),
  ]);

  const patientFullName = patientUser
    ? [patientUser.firstName, patientUser.lastName].filter(Boolean).join(' ')
    : 'Paciente';

  const doses = result.rows.map((row) => ({
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicine_name,
    image: row.medicine_image,
    doseAmount: Number(row.dose_quantity),
    doseUnit: row.dose_unit || 'mg',
    pharmaceuticalForm: row.pharmaceutical_form || 'Tableta',
    scheduledTime: new Date(row.scheduled_time).toLocaleTimeString('es-HN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Tegucigalpa',
    }),
    status: row.status_name,
  }));

  return {
    patientId: Number(patientId),
    patientName: patientFullName,
    date: resolvedDate,
    doses,
  };
}

module.exports = {
  getPatientSummary,
  getPatientMedicines,
  getPatientCalendar,
  getPatientDoses,
};