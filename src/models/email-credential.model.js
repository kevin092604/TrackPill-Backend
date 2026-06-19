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

module.exports = {
  findByUserId,
  mapEmailCredential,
};
