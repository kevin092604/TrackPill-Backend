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

module.exports = {
  registerMedicine,
};
