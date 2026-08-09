const medicineService = require('../services/medicine.service');
const pharmacyService = require('../services/pharmacy.service');
const { createHttpError } = require('../utils/helpers');

async function registerMedicine(req, res, next) {
  try {
    const result = await medicineService.registerMedicine(req.user.id, req.body);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para obtener la lista de medicamentos (soporta búsqueda).
 */
async function getMedicines(req, res, next) {
  try {
    const search = req.query.search || '';
    const medicines = await medicineService.getMedicines(req.user.id, search);

    res.status(200).json({
      success: true,
      medicines,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para obtener el detalle de un medicamento específico.
 */
async function getMedicineDetail(req, res, next) {
  try {
    const detail = await medicineService.getMedicineDetail(req.params.id, req.user.id);

    res.status(200).json({
      success: true,
      medicine: detail,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para actualizar un medicamento existente.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function updateMedicine(req, res, next) {
  try {
    const updatedMedicine = await medicineService.updateMedicine(
      req.params.id, 
      req.user.id, 
      req.body
    );

    res.status(200).json({
      success: true,
      medicine: updatedMedicine,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteMedicine(req, res, next) {
  try {
    const result = await medicineService.deleteMedicine(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para obtener las farmacias cercanas con disponibilidad y precios.
 */
async function getNearbyPharmacies(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      throw createHttpError(400, 'Se requieren latitud (lat) y longitud (lng) para la búsqueda.', 'bad_request');
    }

    const pharmacies = await pharmacyService.getNearbyPharmacies(
      req.params.id,
      lat,
      lng,
      req.user.id
    );

    res.status(200).json({
      success: true,
      pharmacies,
    });
  } catch (error) {
    next(error);
  }
}

async function registerDoseStatus(req, res, next) {
  try {
    const result = await medicineService.registerDoseStatus(
      req.params.id,
      req.params.doseId,
      req.user.id,
      req.body,
    );

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function getMedicationHistory(req, res, next) {
  try {
    const { from, to } = req.query;
    const history = await medicineService.getMedicationHistory(req.user.id, { from, to });

    res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
}

async function uploadPhoto(req, res, next) {
  try {
    const result = await medicineService.uploadMedicinePhoto(req.params.id, req.user.id, req.file);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function getCatalog(req, res, next) {
  try {
    const catalog = await medicineService.getCatalog();

    res.status(200).json({ success: true, ...catalog });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerMedicine,
  getMedicines,
  getMedicineDetail,
  updateMedicine,
  deleteMedicine,
  getNearbyPharmacies,
  registerDoseStatus,
  getMedicationHistory,
  uploadPhoto,
  getCatalog,
};
