
const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/patient/summary', dashboardController.getPatientSummary);
router.get('/caregiver/summary', dashboardController.getCaregiverSummary);

module.exports = router;