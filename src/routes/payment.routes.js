const express = require('express');

const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/methods', paymentController.listPaymentMethods);
router.post('/methods', paymentController.addPaymentMethod);
router.delete('/methods/:id', paymentController.removePaymentMethod);
router.get('/history', paymentController.getPaymentHistory);
router.post('/process', paymentController.processPayment);

module.exports = router;
