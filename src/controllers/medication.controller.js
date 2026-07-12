const medicationService = require('../services/medication.service');

async function registerMedication(req, res, next) {
  try {
    const result = await medicationService.registerMedication(req.user.id, req.body);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerMedication,
};
