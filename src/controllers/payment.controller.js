const paymentService = require('../services/payment.service');

async function listPaymentMethods(req, res, next) {
  try {
    const paymentMethods = await paymentService.listPaymentMethods(req.user.id);

    res.status(200).json({ success: true, paymentMethods });
  } catch (error) {
    next(error);
  }
}

async function addPaymentMethod(req, res, next) {
  try {
    const result = await paymentService.addPaymentMethod(req.user.id, req.body);

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function removePaymentMethod(req, res, next) {
  try {
    const result = await paymentService.removePaymentMethod(Number(req.params.id), req.user.id);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function getPaymentHistory(req, res, next) {
  try {
    const payments = await paymentService.getPaymentHistory(req.user.id);

    res.status(200).json({ success: true, payments });
  } catch (error) {
    next(error);
  }
}

async function processPayment(req, res, next) {
  try {
    const result = await paymentService.processPayment(req.user.id, req.body);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  getPaymentHistory,
  processPayment,
};
