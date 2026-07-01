const db = require('../config/db');

function mapVerificationCode(row) {
  if (!row) {
    return null;
  }

  return {
    creationDate: row.creation_date,
    expirationDate: row.expiration_date,
    hashCode: row.hash_code,
    id: row.id,
    type: row.type,
    used: row.used,
    userId: row.user_id,
  };
}

async function create(code, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.verification_codes (user_id, type, hash_code, expiration_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [code.userId, code.type, code.hashCode, code.expirationDate],
  );

  return mapVerificationCode(result.rows[0]);
}

async function findLatestByUserAndType(userId, type, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM auth.verification_codes
      WHERE user_id = $1
        AND type = $2
      ORDER BY creation_date DESC
      LIMIT 1
    `,
    [userId, type],
  );

  return mapVerificationCode(result.rows[0]);
}

async function markUsed(id, client = db) {
  const result = await client.query(
    `
      UPDATE auth.verification_codes
      SET used = TRUE
      WHERE id = $1
        AND used = FALSE
      RETURNING *
    `,
    [id],
  );

  return mapVerificationCode(result.rows[0]);
}

async function markUnusedAsUsed(userId, type, client = db) {
  await client.query(
    `
      UPDATE auth.verification_codes
      SET used = TRUE
      WHERE user_id = $1
        AND type = $2
        AND used = FALSE
    `,
    [userId, type],
  );
}

module.exports = {
  create,
  findLatestByUserAndType,
  markUnusedAsUsed,
  markUsed,
  mapVerificationCode,
};
