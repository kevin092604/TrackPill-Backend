const db = require('../config/db');

function mapPayment(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    paymentMethodId: row.payment_method_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    description: row.description,
    creationDate: row.creation_date,
    processedDate: row.processed_date,
  };
}

async function findByUserId(userId, client = db) {
  const result = await client.query(
    `SELECT * FROM billing.payments
     WHERE user_id = $1
     ORDER BY creation_date DESC`,
    [userId],
  );

  return result.rows.map(mapPayment);
}

async function findById(id, client = db) {
  const result = await client.query('SELECT * FROM billing.payments WHERE id = $1', [id]);
  return mapPayment(result.rows[0]);
}

async function create(data, client = db) {
  const result = await client.query(
    `INSERT INTO billing.payments (
      user_id, subscription_id, payment_method_id, amount, currency, status, description
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.userId,
      data.subscriptionId || null,
      data.paymentMethodId || null,
      data.amount,
      data.currency || 'HNL',
      data.status || 'pendiente',
      data.description || null,
    ],
  );

  return mapPayment(result.rows[0]);
}

async function updateStatus(id, status, client = db) {
  const result = await client.query(
    `UPDATE billing.payments
     SET status = $2, processed_date = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status],
  );

  return mapPayment(result.rows[0]);
}

module.exports = {
  findByUserId,
  findById,
  create,
  updateStatus,
};
