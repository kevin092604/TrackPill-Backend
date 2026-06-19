const express = require('express');

const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/social', authController.socialAuth);
router.post('/social-register', authController.socialRegister);

module.exports = router;
