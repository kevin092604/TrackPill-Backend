const db = require('../config/db');

function mapSession(row) {
  if (!row) {
    return null;
  }

  return {
    active: row.active,
    creationDate: row.creation_date,
    id: row.id,
    ipAddress: row.ip_address,
    refreshToken: row.refresh_token,
    userAgent: row.user_agent,
    userId: row.user_id,
  };
}

async function create(session, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.sessions (user_id, refresh_token, ip_address, user_agent, active)
      VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
      RETURNING *
    `,
    [
      session.userId,
      session.refreshToken,
      session.ipAddress,
      session.userAgent,
      session.active,
    ],
  );

  return mapSession(result.rows[0]);
}

/**
 * Función que busca una sesión de usuario por su id
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/06/21
 * @date 2026/06/21
 * @param {string} id - El id de la sesión a buscar
 * @param {Object} [client=db] - Cliente de la base de datos por defecto
 * @returns {Promise<Object|null>} La sesión encontrada o null si no existe
 */
async function findById(id, client = db) {

  const result = await client.query(
    `SELECT * FROM auth.sessions WHERE id = $1 LIMIT 1`,
    [id]
  );

  return mapSession(result.rows[0]);
}

async function revokeById(id, userId, client = db) {
  const result = await client.query(
    `
      UPDATE auth.sessions
      SET active = FALSE
      WHERE id = $1
        AND user_id = $2
        AND active = TRUE
      RETURNING *
    `,
    [id, userId],
  );

  return mapSession(result.rows[0]);
}

async function revokeAllByUserId(userId, client = db) {
  const result = await client.query(
    `
      UPDATE auth.sessions
      SET active = FALSE
      WHERE user_id = $1
        AND active = TRUE
    `,
    [userId],
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  mapSession,
  revokeAllByUserId,
  revokeById,
};
