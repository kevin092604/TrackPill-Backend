const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router();
router.use(authMiddleware);

router.get('/',notificationController.getNotifications)

module.exports = router;