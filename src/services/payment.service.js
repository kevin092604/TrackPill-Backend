const { z } = require('zod');

const Payment = require('../models/payment.model');
const PaymentMethod = require('../models/payment-method.model');
const Subscription = require('../models/subscription.model');
const { createHttpError } = require('../utils/helpers');

const addPaymentMethodSchema = z.object({
  provider: z.string().trim().min(1).default('manual'),
  tokenReference: z.string().trim().min(1, 'Falta la referencia del metodo de pago.'),
  brand: z.string().trim().max(40).optional().nullable(),
  last4: z.string().trim().regex(/^\d{4}$/, 'Los ultimos 4 digitos deben ser numericos.').optional().nullable(),
  cardholderName: z.string().trim().max(180).optional().nullable(),
  expirationMonth: z.number().int().min(1).max(12).optional().nullable(),
  expirationYear: z.number().int().min(new Date().getFullYear()).optional().nullable(),
  isDefault: z.boolean().default(false),
});

const processPaymentSchema = z.object({
  paymentId: z.number().int().positive().optional(),
  paymentMethodId: z.number().int().positive('Selecciona un metodo de pago.'),
  amount: z.coerce.number().positive('Ingresa un monto valido.').optional(),
  currency: z.string().trim().length(3).optional(),
  description: z.string().trim().max(255).optional(),
}).refine(
  (data) => data.paymentId || data.amount,
  { message: 'Se requiere un paymentId existente o un monto para crear el pago.', path: ['amount'] },
);

/**
 * Indica si hay una pasarela de pago real configurada. Ninguna esta
 * conectada todavia; se deja el interruptor listo para cuando exista.
 */
function isPaymentGatewayConfigured() {
  return Boolean(process.env.PAYMENT_GATEWAY_PROVIDER && process.env.PAYMENT_GATEWAY_API_KEY);
}

async function listPaymentMethods(userId) {
  return PaymentMethod.findByUserId(userId);
}

async function addPaymentMethod(userId, payload) {
  const result = addPaymentMethodSchema.safeParse(payload);
  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  const data = result.data;
  const existingCount = await PaymentMethod.countActiveByUserId(userId);
  const makeDefault = data.isDefault || existingCount === 0;

  if (makeDefault) {
    await PaymentMethod.unsetDefaultForUser(userId);
  }

  const method = await PaymentMethod.create(userId, { ...data, isDefault: makeDefault });

  return { action: 'payment_method_added', status: 'success', paymentMethod: method };
}

async function removePaymentMethod(methodId, userId) {
  const method = await PaymentMethod.findById(methodId);
  if (!method) {
    throw createHttpError(404, 'Metodo de pago no encontrado.', 'payment_method_not_found');
  }
  if (method.userId !== userId) {
    throw createHttpError(403, 'No tienes permiso para eliminar este metodo de pago.', 'unauthorized');
  }

  const removed = await PaymentMethod.softDelete(methodId);

  if (method.isDefault) {
    const remaining = await PaymentMethod.findByUserId(userId);
    if (remaining.length > 0) {
      await PaymentMethod.setDefault(remaining[0].id);
    }
  }

  return { action: 'payment_method_removed', status: 'success', paymentMethod: removed };
}

async function getPaymentHistory(userId) {
  return Payment.findByUserId(userId);
}

async function processPayment(userId, payload) {
  const result = processPaymentSchema.safeParse(payload);
  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  const data = result.data;

  const method = await PaymentMethod.findById(data.paymentMethodId);
  if (!method || method.userId !== userId) {
    throw createHttpError(404, 'Metodo de pago no encontrado.', 'payment_method_not_found');
  }

  let payment;
  if (data.paymentId) {
    payment = await Payment.findById(data.paymentId);
    if (!payment || payment.userId !== userId) {
      throw createHttpError(404, 'Pago no encontrado.', 'payment_not_found');
    }
    if (payment.status !== 'pendiente') {
      throw createHttpError(409, 'Este pago ya fue procesado.', 'payment_already_processed');
    }
  } else {
    const subscription = await Subscription.findByUserId(userId);
    payment = await Payment.create({
      userId,
      subscriptionId: subscription?.id || null,
      paymentMethodId: method.id,
      amount: data.amount,
      currency: data.currency || 'HNL',
      status: 'pendiente',
      description: data.description || 'Pago de suscripcion TrackPill',
    });
  }

  if (!isPaymentGatewayConfigured()) {
    throw createHttpError(
      503,
      'El procesamiento de pagos no esta configurado en el servidor (falta una pasarela de pago real). ' +
      'El pago quedo registrado como pendiente.',
      'payment_gateway_not_configured',
      { paymentId: payment.id },
    );
  }

  // Punto de integracion: aqui se llamaria a la pasarela real (Stripe/PayPal/etc.)
  // con method.tokenReference y data.amount, y se actualizaria el estado segun
  // la respuesta. Como no hay pasarela conectada, este bloque nunca se alcanza.
  const updated = await Payment.updateStatus(payment.id, 'completado');

  return { action: 'payment_processed', status: 'success', payment: updated };
}

module.exports = {
  isPaymentGatewayConfigured,
  listPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  getPaymentHistory,
  processPayment,
};
