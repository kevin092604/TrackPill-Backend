const express = require('express');
const multer = require('multer');

const medicineController = require('../controllers/medicine.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = express.Router();

router.use(authMiddleware);

router.post('/', medicineController.registerMedicine);
router.get('/', medicineController.getMedicines);
router.get('/catalog', medicineController.getCatalog);
router.get('/history', medicineController.getMedicationHistory);
router.get('/:id', medicineController.getMedicineDetail);
router.put('/:id', medicineController.updateMedicine);
router.post('/:id/photo', upload.single('photo'), medicineController.uploadPhoto);
router.get('/:id/pharmacies', medicineController.getNearbyPharmacies);
router.patch('/:id/doses/:doseId', medicineController.registerDoseStatus);

module.exports = router;
