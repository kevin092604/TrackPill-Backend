const { z } = require('zod');

const db = require('../config/db');
const Schedule = require('../models/schedule.model');
const Medicine = require('../models/medicine.model');
const { createHttpError } = require('../utils/helpers');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const registerMedicineSchema = z.object(
  {
    name: z.string().trim().min(1, 'Ingresa el nombre del medicamento.').max(120),
    pharmaceuticalFormId: z.number().int().positive('Selecciona una forma farmacéutica válida.'),
    currentStock: z.coerce.number({ invalid_type_error: 'Ingresa el inventario actual.' })
      .min(0, 'El inventario no puede ser negativo.'),
    dose: z.coerce.number({ invalid_type_error: 'Ingresa la dosis.' })
      .positive('Ingresa una dosis válida'),
    frequency: z.number().int().positive('Ingresa una frecuencia válida.'),
    timeUnitId: z.number().int().positive('Ingresa una unidad de tiempo válida.'),
    startTime: z.string().regex(TIME_REGEX, 'Formato de hora de inicio inválido.'),
    description: z.string().trim().optional().nullable(),
    lowStockAlertEnabled: z.boolean().default(false),
    lowStockThreshold: z.coerce.number().positive().optional().nullable(),
    schedule: z.object(
      {
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        monday: z.boolean().default(false),
        tuesday: z.boolean().default(false),
        wednesday: z.boolean().default(false),
        thursday: z.boolean().default(false),
        friday: z.boolean().default(false),
        saturday: z.boolean().default(false),
        sunday: z.boolean().default(false),
      }
    )
  }
).refine(
  (data) => !data.lowStockAlertEnabled || Number.isFinite(data.lowStockThreshold),
  { message: 'Indica a partir de cuántas dosis avisar.', path: ['lowStockThreshold'] },
);

async function registerMedicine(userId, payload) {
  const result = registerMedicineSchema.safeParse(payload);

  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  const data = result.data;

  const medicine = await db.transaction(async (client) => {

    const createdSchedule = await Schedule.create(data.schedule, client);

    const createdMedicine = await Medicine.create(
      {
        name: data.name,
        image: data.image || null,
        pharmaceuticalFormId: data.pharmaceuticalFormId,
        currentStock: data.currentStock,
        dose: data.dose,
        frequency: data.frequency,
        timeUnitId: data.timeUnitId,
        startTime: data.startTime,
        scheduleId: createdSchedule.id,
        description: data.description || null,
        lowStockAlertEnabled: data.lowStockAlertEnabled,
        lowStockThreshold: data.lowStockAlertEnabled ? data.lowStockThreshold : null,
        userId,
      },
      client,
    );

    return createdMedicine;
  });

  return { medicine };
}

/**
 * Calcula los límites de fecha de la semana actual.
 */
function getCurrentWeekBounds() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

/**
 * Obtiene la lista de medicamentos de un usuario (con búsqueda).
 */
async function getMedicines(userId, search = '') {
  const medicines = await Medicine.findAllByUserId(userId, search);

  for (const med of medicines) {
    const nextDoseResult = await db.query(
      `SELECT scheduled_time 
       FROM medicine_stock.medication_logs 
       WHERE medicine_id = $1 
         AND scheduled_time >= NOW() 
         AND status_id IN (1, 3)
       ORDER BY scheduled_time ASC 
       LIMIT 1`,
      [med.id]
    );
    med.nextScheduledTime = nextDoseResult.rows[0]?.scheduled_time || null;
  }

  return medicines;
}

/**
 * Obtiene el detalle de un medicamento específico.
 */
async function getMedicineDetail(medicineId, userId) {
  const detail = await Medicine.findDetailById(medicineId);

  if (!detail) {
    throw createHttpError(404, 'Medicamento no encontrado.', 'medicine_not_found');
  }

  if (detail.userId !== userId) {
    throw createHttpError(403, 'No tienes permiso para ver este medicamento.', 'unauthorized');
  }

  // A. Calcular estimación de días de inventario restantes
  const dailyDoses = 24 / detail.frequency;
  const dailyDoseAmount = dailyDoses * detail.dose;
  const daysRemaining = dailyDoseAmount > 0 
    ? Math.round(detail.currentStock / dailyDoseAmount) 
    : 0;

  // B. Obtener historial de cumplimiento semanal de este medicamento (Lunes a Domingo)
  const { monday, sunday } = getCurrentWeekBounds();
  const logsResult = await db.query(
    `SELECT scheduled_time, status_id 
     FROM medicine_stock.medication_logs 
     WHERE medicine_id = $1 
       AND scheduled_time >= $2 
       AND scheduled_time <= $3`,
    [medicineId, monday, sunday]
  );
  
  const logs = logsResult.rows;
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const weeklyCompliance = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);

    const dayLogs = logs.filter(log => {
      const logDate = new Date(log.scheduled_time);
      return logDate.toDateString() === dayDate.toDateString();
    });

    let status = 'none';
    if (dayLogs.length > 0) {
      const completedCount = dayLogs.filter(log => log.status_id === 2).length;
      status = completedCount === dayLogs.length ? 'completed' : 'failed';
    }

    weeklyCompliance.push({
      day: dayNames[i],
      status
    });
  }

  return {
    ...detail,
    daysRemaining,
    weeklyCompliance
  };
}

const updateMedicineSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre del medicamento.').max(120).optional(),
  image: z.string().optional().nullable(),
  pharmaceuticalFormId: z.number().int().positive().optional(),
  currentStock: z.coerce.number().min(0).optional(),
  dose: z.coerce.number().positive().optional(),
  frequency: z.number().int().positive().optional(),
  timeUnitId: z.number().int().positive().optional(),
  startTime: z.string().regex(TIME_REGEX, 'Formato de hora de inicio inválido.').optional(),
  description: z.string().trim().optional().nullable(),
  lowStockAlertEnabled: z.boolean().optional(),
  lowStockThreshold: z.coerce.number().positive().optional().nullable(),
  schedule: z.object({
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    monday: z.boolean().optional(),
    tuesday: z.boolean().optional(),
    wednesday: z.boolean().optional(),
    thursday: z.boolean().optional(),
    friday: z.boolean().optional(),
    saturday: z.boolean().optional(),
    sunday: z.boolean().optional(),
  }).optional()
}).refine(
  (data) => {
    if (data.lowStockAlertEnabled !== undefined && data.lowStockAlertEnabled) {
      return data.lowStockThreshold != null;
    }
    return true;
  },
  { message: 'Indica a partir de cuántas dosis avisar.', path: ['lowStockThreshold'] }
);

/**
 * Servicio para actualizar un medicamento.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function updateMedicine(medicineId, userId, payload) {
  const result = updateMedicineSchema.safeParse(payload);

  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  const data = result.data;

  const existingMedicine = await Medicine.findById(medicineId);
  if (!existingMedicine) {
    throw createHttpError(404, 'Medicamento no encontrado.', 'medicine_not_found');
  }
  if (existingMedicine.userId !== userId) {
    throw createHttpError(403, 'No tienes permiso para editar este medicamento.', 'unauthorized');
  }

  const updatedMedicine = await db.transaction(async (client) => {
    
    if (data.schedule) {
      await Schedule.update(existingMedicine.scheduleId, data.schedule, client);
    }

    return await Medicine.update(medicineId, data, client);
  });

  return updatedMedicine;
}

module.exports = {
  registerMedicine,
  getMedicines,
  getMedicineDetail,
  updateMedicine
};