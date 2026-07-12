const express = require('express');

const medicationController = require('../controllers/medication.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);
router.post('/', medicationController.registerMedication);

module.exports = router;
