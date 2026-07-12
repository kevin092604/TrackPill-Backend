const express = require('express');

const caregiverController = require('../controllers/caregiver.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkCaregiverPatientRelationship = require('../middlewares/caregiver-patient.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get(
    '/patients/:patientId/calendar',
    checkCaregiverPatientRelationship,
    caregiverController.getPatientCalendar
);

router.get(
    '/patients/:patientId/doses',
    checkCaregiverPatientRelationship,
    caregiverController.getPatientDoses
);

router.get('/patients/:patientId/summary',
    checkCaregiverPatientRelationship,
    caregiverController.getPatientSummary
);

module.exports = router;