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

/**
 * Incrementa el contador de intentos fallidos de inicio de sesión.
 * Si llega a 5, bloquea la cuenta por 15 minutos.
 * @author agblandin@unah.hn
 * @since 2026/06/23
 */
async function recordFailedAttempt(userId, client = db) {
  await client.query(
    `
      UPDATE email_credentials
      SET 
        failed_attempts = failed_attempts + 1,
        locked_until = CASE 
          WHEN (failed_attempts + 1) >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until
        END
      WHERE user_id = $1
    `,
    [userId]
  );
}

/**
 * Reinicia el contador de intentos fallidos a 0 y elimina el bloqueo.
 * @author agblandin@unah.hn
 * @since 2026/06/23
 */
async function resetAttempts(userId, client = db) {
  await client.query(
    `
      UPDATE email_credentials
      SET 
        failed_attempts = 0,
        locked_until = NULL
      WHERE user_id = $1
    `,
    [userId]
  );
}

module.exports = {
  findByUserId,
  mapEmailCredential,
  recordFailedAttempt,
  resetAttempts
};
