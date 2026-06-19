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
      INSERT INTO verification_codes (user_id, type, hash_code, expiration_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [code.userId, code.type, code.hashCode, code.expirationDate],
  );

  return mapVerificationCode(result.rows[0]);
}

module.exports = {
  create,
  mapVerificationCode,
};
