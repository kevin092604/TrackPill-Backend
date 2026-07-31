const { z } = require('zod');

const SavedList = require('../models/saved-medicine-list.model');
const Medicine = require('../models/medicine.model');
const caregiverService = require('./caregiver.service');
const { createHttpError } = require('../utils/helpers');

const createListSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa un nombre para la lista.').max(120),
  medicineNames: z.array(z.string().trim().min(1)).min(1, 'Agrega al menos un medicamento a la lista.'),
});

const updateListSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  medicineNames: z.array(z.string().trim().min(1)).optional(),
});

async function getLists(userId) {
  return SavedList.findByUserId(userId);
}

async function getList(listId, userId) {
  const list = await SavedList.findById(listId);
  if (!list) throw createHttpError(404, 'Lista no encontrada.', 'saved_list_not_found');
  if (list.userId !== userId) throw createHttpError(403, 'No tienes permiso para ver esta lista.', 'unauthorized');
  return list;
}

async function createList(userId, payload) {
  const result = createListSchema.safeParse(payload);
  if (!result.success) throw createHttpError(422, result.error.issues[0].message, 'validation_error');

  const list = await SavedList.create(userId, result.data.name, result.data.medicineNames);
  return { action: 'saved_list_created', status: 'success', list };
}

async function updateList(listId, userId, payload) {
  const result = updateListSchema.safeParse(payload);
  if (!result.success) throw createHttpError(422, result.error.issues[0].message, 'validation_error');

  const existing = await SavedList.findById(listId);
  if (!existing) throw createHttpError(404, 'Lista no encontrada.', 'saved_list_not_found');
  if (existing.userId !== userId) throw createHttpError(403, 'No tienes permiso para editar esta lista.', 'unauthorized');

  const list = await SavedList.update(
    listId,
    result.data.name ?? existing.name,
    result.data.medicineNames,
  );

  return { action: 'saved_list_updated', status: 'success', list };
}

async function deleteList(listId, userId) {
  const existing = await SavedList.findById(listId);
  if (!existing) throw createHttpError(404, 'Lista no encontrada.', 'saved_list_not_found');
  if (existing.userId !== userId) throw createHttpError(403, 'No tienes permiso para eliminar esta lista.', 'unauthorized');

  await SavedList.remove(listId);
  return { action: 'saved_list_deleted', status: 'success' };
}

/**
 * Genera (sin guardar) una lista de nombres de medicamentos a partir de los
 * medicamentos activos del propio usuario, lista para pasar al comparador
 * de precios (HU-25 / SCRUM-146).
 */
async function generateOwnList(userId) {
  const medicines = await Medicine.findAllByUserId(userId);

  return {
    medicineNames: [...new Set(medicines.map((m) => m.name))],
  };
}

/**
 * Igual que `generateOwnList` pero para el cuidador de un paciente vinculado
 * (HU-25 / SCRUM-147). Reutiliza la verificacion de vinculo aceptado/activo
 * que ya hace caregiverService.getPatientMedicines.
 */
async function generatePatientList(caregiverId, patientId) {
  const data = await caregiverService.getPatientMedicines(caregiverId, patientId);

  return {
    patientId: data.patientId,
    patientName: data.patientName,
    medicineNames: [...new Set(data.medicines.map((m) => m.name))],
  };
}

module.exports = {
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
  generateOwnList,
  generatePatientList,
};
