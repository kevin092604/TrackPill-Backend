const express = require('express');
const multer = require('multer');

const medicationController = require('../controllers/medication.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = express.Router();

router.use(authMiddleware);
router.post('/', upload.single('photo'), medicationController.registerMedication);

module.exports = router;
