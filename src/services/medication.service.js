const { z } = require('zod');

const db = require('../config/db');
const DoseSchedule = require('../models/dose-schedule.model');
const Medication = require('../models/medication.model');
const { createHttpError } = require('../utils/helpers');
const storageService = require('./storage.service');

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/bmp', 'image/jpeg', 'image/png']);
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const registerMedicationSchema = z.object({
  currentInventory: z.coerce.number({ invalid_type_error: 'Ingresa el inventario actual.' })
    .int('El inventario debe ser un numero entero.')
    .min(0, 'El inventario no puede ser negativo.'),
  doseAmount: z.coerce.number({ invalid_type_error: 'Ingresa la dosis.' })
    .positive('Ingresa una dosis valida.'),
  doseUnit: z.string().trim().min(1, 'Selecciona la unidad de medida.').max(20),
  frequencyType: z.enum(['8h', '12h', '24h', 'custom'], {
    errorMap: () => ({ message: 'Selecciona una frecuencia valida.' }),
  }),
  lowStockAlertEnabled: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, 'Ingresa el nombre del medicamento.').max(120),
  pharmaceuticalForm: z.string().trim().min(1, 'Selecciona la forma farmaceutica.').max(60),
  schedules: z.array(z.string().regex(TIME_REGEX, 'Formato de horario invalido.'))
    .min(1, 'Agrega al menos un horario de dosis.'),
}).refine(
  (data) => !data.lowStockAlertEnabled || Number.isFinite(data.lowStockThreshold),
  { message: 'Indica a partir de cuantas dosis avisar.', path: ['lowStockThreshold'] },
);

function parseSchedules(rawSchedules) {
  if (Array.isArray(rawSchedules)) {
    return rawSchedules;
  }

  try {
    const parsed = JSON.parse(rawSchedules || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    throw createHttpError(422, 'Los horarios de dosis son invalidos.', 'validation_error');
  }
}

function parseBoolean(value) {
  return value === true || value === 'true';
}

async function registerMedication(userId, payload, file) {
  const result = registerMedicationSchema.safeParse({
    ...payload,
    lowStockAlertEnabled: parseBoolean(payload.lowStockAlertEnabled),
    schedules: parseSchedules(payload.schedules),
  });

  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  if (file && !ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(
      422,
      'Formato no soportado. Usa .png, .jpeg, .jpg o .bmp.',
      'invalid_photo_format',
    );
  }

  const data = result.data;

  const medication = await db.transaction(async (client) => {
    const createdMedication = await Medication.create(
      {
        currentInventory: data.currentInventory,
        doseAmount: data.doseAmount,
        doseUnit: data.doseUnit,
        frequencyType: data.frequencyType,
        lowStockAlertEnabled: data.lowStockAlertEnabled,
        lowStockThreshold: data.lowStockAlertEnabled ? data.lowStockThreshold : null,
        name: data.name,
        pharmaceuticalForm: data.pharmaceuticalForm,
        userId,
      },
      client,
    );

    await DoseSchedule.createMany(createdMedication.id, data.schedules, client);

    return createdMedication;
  });

  if (!file) {
    return { medication };
  }

  const photoUrl = await storageService.uploadPublicFile(`medication-photos/${userId}`, file);
  const updatedMedication = await Medication.updatePhotoUrl(medication.id, photoUrl);

  return { medication: updatedMedication };
}

module.exports = {
  registerMedication,
};
