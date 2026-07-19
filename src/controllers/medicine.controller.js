const medicineService = require('../services/medicine.service');

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

module.exports = {
  registerMedicine,
  getMedicines,
  getMedicineDetail,
  updateMedicine
};
