const db = require('../config/db');

function mapPaymentMethod(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    brand: row.brand,
    last4: row.last4,
    cardholderName: row.cardholder_name,
    expirationMonth: row.expiration_month,
    expirationYear: row.expiration_year,
    isDefault: row.is_default,
    creationDate: row.creation_date,
  };
}

async function findByUserId(userId, client = db) {
  const result = await client.query(
    `SELECT * FROM billing.payment_methods
     WHERE user_id = $1 AND removed_date IS NULL
     ORDER BY is_default DESC, creation_date DESC`,
    [userId],
  );

  return result.rows.map(mapPaymentMethod);
}

async function findById(id, client = db) {
  const result = await client.query(
    'SELECT * FROM billing.payment_methods WHERE id = $1 AND removed_date IS NULL',
    [id],
  );

  return mapPaymentMethod(result.rows[0]);
}

async function countActiveByUserId(userId, client = db) {
  const result = await client.query(
    'SELECT COUNT(*)::int AS count FROM billing.payment_methods WHERE user_id = $1 AND removed_date IS NULL',
    [userId],
  );

  return result.rows[0].count;
}

async function unsetDefaultForUser(userId, client = db) {
  await client.query(
    'UPDATE billing.payment_methods SET is_default = FALSE WHERE user_id = $1',
    [userId],
  );
}

async function create(userId, data, client = db) {
  const result = await client.query(
    `INSERT INTO billing.payment_methods (
      user_id, provider, token_reference, brand, last4,
      cardholder_name, expiration_month, expiration_year, is_default
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      userId,
      data.provider,
      data.tokenReference,
      data.brand || null,
      data.last4 || null,
      data.cardholderName || null,
      data.expirationMonth || null,
      data.expirationYear || null,
      data.isDefault,
    ],
  );

  return mapPaymentMethod(result.rows[0]);
}

async function setDefault(id, client = db) {
  const result = await client.query(
    'UPDATE billing.payment_methods SET is_default = TRUE WHERE id = $1 RETURNING *',
    [id],
  );

  return mapPaymentMethod(result.rows[0]);
}

async function softDelete(id, client = db) {
  const result = await client.query(
    `UPDATE billing.payment_methods
     SET removed_date = NOW(), is_default = FALSE
     WHERE id = $1 AND removed_date IS NULL
     RETURNING *`,
    [id],
  );

  return mapPaymentMethod(result.rows[0]);
}

module.exports = {
  findByUserId,
  findById,
  countActiveByUserId,
  unsetDefaultForUser,
  create,
  setDefault,
  softDelete,
};
