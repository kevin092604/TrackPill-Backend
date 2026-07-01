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
    'SELECT * FROM auth.email_credentials WHERE user_id = $1 LIMIT 1',
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

async function create(credential, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.email_credentials (
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
      UPDATE auth.email_credentials
      SET verified = TRUE,
          verified_date = COALESCE(verified_date, NOW())
      WHERE user_id = $1
      RETURNING *
    `,
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

async function recordFailedAttempt(userId, client = db) {
  const result = await client.query(
    `
      UPDATE auth.email_credentials
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE
            WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
            ELSE locked_until
          END
      WHERE user_id = $1
      RETURNING *
    `,
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

async function resetAttempts(userId, client = db) {
  const result = await client.query(
    `
      UPDATE auth.email_credentials
      SET failed_attempts = 0,
          locked_until = NULL
      WHERE user_id = $1
      RETURNING *
    `,
    [userId],
  );

  return mapEmailCredential(result.rows[0]);
}

/**
 * Función que actualiza la contraseña de un usuario e inicializa el estado de intentos de login.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/06/23
 * @date 2026/06/23
 * @param {number} userId - ID del usuario
 * @param {string} hashPassword - Hash bcrypt de la nueva contraseña
 * @param {object} client - Cliente de la base de datos para transacciones
 * @returns {Promise<object|null>} Las credenciales actualizadas o null si no se encuentra el usuario
 */
async function updatePassword(userId, hashPassword, client = db) {
  const result = await client.query(
    `
      UPDATE auth.email_credentials
      SET hash_password = $2,
          change_date = NOW(),
          failed_attempts = 0,
          locked_until = NULL
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, hashPassword],
  );

  return mapEmailCredential(result.rows[0]);
}

module.exports = {
  create,
  findByUserId,
  markVerified,
  mapEmailCredential,
  recordFailedAttempt,
  resetAttempts,
  updatePassword,
};
