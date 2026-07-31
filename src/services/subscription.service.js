const { z } = require('zod');

const Subscription = require('../models/subscription.model');
const { createHttpError } = require('../utils/helpers');

const changePlanSchema = z.object({
  planCode: z.string().trim().min(1, 'Selecciona un plan valido.'),
});

const billingConfigSchema = z.object({
  autopayEnabled: z.boolean().default(false),
  billingName: z.string().trim().max(180).optional().nullable(),
  billingAddress: z.string().trim().max(255).optional().nullable(),
  billingCity: z.string().trim().max(120).optional().nullable(),
  billingCountry: z.string().trim().max(80).optional().nullable(),
  billingTaxId: z.string().trim().max(60).optional().nullable(),
});

/**
 * Devuelve la suscripcion del usuario, creando una en el plan gratuito si
 * todavia no existe (ej. usuarios registrados antes de esta funcionalidad).
 */
async function getOrCreateSubscription(userId) {
  const existing = await Subscription.findByUserId(userId);
  if (existing) return existing;

  const freePlan = await Subscription.findPlanByCode('free');
  if (!freePlan) {
    throw createHttpError(500, 'No hay un plan gratuito configurado.', 'plan_not_configured');
  }

  return Subscription.createForUser(userId, freePlan.id);
}

async function getPlans() {
  return Subscription.findPlans();
}

async function changePlan(userId, payload) {
  const result = changePlanSchema.safeParse(payload);
  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  await getOrCreateSubscription(userId);

  const plan = await Subscription.findPlanByCode(result.data.planCode);
  if (!plan) {
    throw createHttpError(404, 'El plan solicitado no existe.', 'plan_not_found');
  }

  const subscription = await Subscription.updatePlan(userId, plan.id);

  return { action: 'plan_changed', status: 'success', subscription };
}

async function updateBillingConfig(userId, payload) {
  const result = billingConfigSchema.safeParse(payload);
  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  await getOrCreateSubscription(userId);

  const subscription = await Subscription.updateBillingConfig(userId, result.data);

  return { action: 'billing_config_updated', status: 'success', subscription };
}

async function cancelSubscription(userId) {
  const subscription = await getOrCreateSubscription(userId);

  if (subscription.plan.code === 'free') {
    throw createHttpError(
      409,
      'No tienes una suscripcion de pago activa para cancelar.',
      'no_active_paid_subscription',
    );
  }

  const freePlan = await Subscription.findPlanByCode('free');
  const updated = await Subscription.cancel(userId, freePlan.id);

  return { action: 'subscription_cancelled', status: 'success', subscription: updated };
}

module.exports = {
  getOrCreateSubscription,
  getPlans,
  changePlan,
  updateBillingConfig,
  cancelSubscription,
};
