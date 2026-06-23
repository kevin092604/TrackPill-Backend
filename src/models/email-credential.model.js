const db = require('../config/db');

function mapEmailCredential(row) {
  if (!row) {
    return null;
  }

  return {
    changeDate: row.change_date,
    failedAttempts: row.failed_attempts,
    hashPassword: row.hash_password,
    id: row.id,
    lockedUntil: row.locked_until,
    userId: row.user_id,
    verified: row.verified,
    verifiedDate: row.verified_date,
  };
}

async function findByUserId(userId, client = db) {
  const result = await client.query(
    'SELECT * FROM email_credentials WHERE user_id = $1 LIMIT 1',
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

async function create(credential, client = db) {
  const result = await client.query(
    `
      INSERT INTO email_credentials (
        user_id,
        hash_password,
        failed_attempts,
        change_date,
        verified,
        verified_date,
        locked_until
      )
      VALUES ($1, $2, 0, NOW(), FALSE, NULL, NULL)
      RETURNING *
    `,
    [credential.userId, credential.hashPassword],
  );

  return mapEmailCredential(result.rows[0]);
}

async function markVerified(userId, client = db) {
  const result = await client.query(
    `
      UPDATE email_credentials
      SET verified = TRUE,
          verified_date = COALESCE(verified_date, NOW())
      WHERE user_id = $1
      RETURNING *
    `,
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

module.exports = {
  create,
  findByUserId,
  markVerified,
  mapEmailCredential,
};
