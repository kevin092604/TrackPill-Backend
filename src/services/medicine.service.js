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

module.exports = {
  registerMedicine,
};