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
      INSERT INTO sessions (user_id, refresh_token, ip_address, user_agent, active)
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

module.exports = {
  create,
  mapSession,
};
