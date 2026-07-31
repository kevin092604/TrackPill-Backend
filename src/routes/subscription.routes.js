const express = require('express');

const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', subscriptionController.getSubscription);
router.put('/plan', subscriptionController.changePlan);
router.put('/billing', subscriptionController.updateBillingConfig);
router.post('/cancel', subscriptionController.cancelSubscription);

module.exports = router;
