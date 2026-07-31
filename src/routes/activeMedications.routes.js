const express = require('express');
const activeMedications = require('../controllers/activeMedications.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', activeMedications.getActiveMedications);

module.exports = router;