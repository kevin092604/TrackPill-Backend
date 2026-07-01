const express = require('express');

const authController = require('../controllers/auth.controller');
const loginLimiter = require('../middlewares/loginLimiter.middleware');

const router = express.Router();

router.post('/social', authController.socialAuth);
router.post('/social/complete-register', authController.socialCompleteRegister);
router.post('/social-register', authController.socialRegister);
router.get('/apple/callback', authController.appleCallback);
router.post('/apple/callback', authController.appleCallback);
router.post('/login',loginLimiter,authController.authenticateWithEmailAndPassword);

module.exports = router;
