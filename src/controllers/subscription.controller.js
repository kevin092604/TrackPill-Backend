const subscriptionService = require('../services/subscription.service');

async function getSubscription(req, res, next) {
  try {
    const [subscription, plans] = await Promise.all([
      subscriptionService.getOrCreateSubscription(req.user.id),
      subscriptionService.getPlans(),
    ]);

    res.status(200).json({ success: true, subscription, plans });
  } catch (error) {
    next(error);
  }
}

async function changePlan(req, res, next) {
  try {
    const result = await subscriptionService.changePlan(req.user.id, req.body);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function updateBillingConfig(req, res, next) {
  try {
    const result = await subscriptionService.updateBillingConfig(req.user.id, req.body);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function cancelSubscription(req, res, next) {
  try {
    const result = await subscriptionService.cancelSubscription(req.user.id);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubscription,
  changePlan,
  updateBillingConfig,
  cancelSubscription,
};
