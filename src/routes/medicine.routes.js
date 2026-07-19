const express = require('express');

const medicineController = require('../controllers/medicine.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/', medicineController.registerMedicine);
router.get('/', medicineController.getMedicines);
router.get('/:id', medicineController.getMedicineDetail);

module.exports = router;
