const express = require('express');

const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/', profileController.getProfile);

module.exports = router;
