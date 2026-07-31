const db = require('../config/db');

function mapSubscription(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    autopayEnabled: row.autopay_enabled,
    billingName: row.billing_name,
    billingAddress: row.billing_address,
    billingCity: row.billing_city,
    billingCountry: row.billing_country,
    billingTaxId: row.billing_tax_id,
    currentPeriodEnd: row.current_period_end,
    creationDate: row.creation_date,
    lastUpdate: row.last_update,
    cancellationDate: row.cancellation_date,
    plan: {
      id: row.plan_id,
      code: row.plan_code,
      name: row.plan_name,
      price: Number(row.plan_price),
      currency: row.plan_currency,
      billingInterval: row.billing_interval,
    },
  };
}

const SELECT_WITH_PLAN = `
  SELECT
    s.*,
    p.id AS plan_id,
    p.code AS plan_code,
    p.name AS plan_name,
    p.price AS plan_price,
    p.currency AS plan_currency,
    p.billing_interval
  FROM billing.subscriptions s
  JOIN billing.plans p ON p.id = s.plan_id
`;

async function findPlans(client = db) {
  const result = await client.query('SELECT * FROM billing.plans ORDER BY price ASC');

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    billingInterval: row.billing_interval,
  }));
}

async function findPlanByCode(code, client = db) {
  const result = await client.query('SELECT * FROM billing.plans WHERE code = $1', [code]);
  const row = result.rows[0];

  return row ? {
    id: row.id, code: row.code, name: row.name,
    price: Number(row.price), currency: row.currency, billingInterval: row.billing_interval,
  } : null;
}

async function findByUserId(userId, client = db) {
  const result = await client.query(`${SELECT_WITH_PLAN} WHERE s.user_id = $1`, [userId]);
  return mapSubscription(result.rows[0]);
}

async function createForUser(userId, planId, client = db) {
  const result = await client.query(
    `INSERT INTO billing.subscriptions (user_id, plan_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id`,
    [userId, planId],
  );

  if (result.rows.length === 0) {
    return findByUserId(userId, client);
  }

  const full = await client.query(`${SELECT_WITH_PLAN} WHERE s.id = $1`, [result.rows[0].id]);
  return mapSubscription(full.rows[0]);
}

async function updatePlan(userId, planId, client = db) {
  await client.query(
    `UPDATE billing.subscriptions
     SET plan_id = $2, status = 'activa', cancellation_date = NULL, last_update = NOW()
     WHERE user_id = $1`,
    [userId, planId],
  );

  return findByUserId(userId, client);
}

async function updateBillingConfig(userId, data, client = db) {
  await client.query(
    `UPDATE billing.subscriptions
     SET autopay_enabled = $2,
         billing_name = $3,
         billing_address = $4,
         billing_city = $5,
         billing_country = $6,
         billing_tax_id = $7,
         last_update = NOW()
     WHERE user_id = $1`,
    [
      userId,
      data.autopayEnabled,
      data.billingName || null,
      data.billingAddress || null,
      data.billingCity || null,
      data.billingCountry || null,
      data.billingTaxId || null,
    ],
  );

  return findByUserId(userId, client);
}

async function cancel(userId, freePlanId, client = db) {
  await client.query(
    `UPDATE billing.subscriptions
     SET status = 'cancelada', plan_id = $2, autopay_enabled = FALSE,
         cancellation_date = NOW(), last_update = NOW()
     WHERE user_id = $1`,
    [userId, freePlanId],
  );

  return findByUserId(userId, client);
}

module.exports = {
  findPlans,
  findPlanByCode,
  findByUserId,
  createForUser,
  updatePlan,
  updateBillingConfig,
  cancel,
};
