const db = require('../config/db');

function mapInvitationToken(row) {
  if (!row) {
    return null;
  }

  return {
    creationDate: row.creation_date,
    expirationDate: row.expiration_date,
    id: row.id,
    initiatedAs: row.initiated_as,
    initiatorId: row.initiator_id,
    token: row.token,
    used: row.used,
  };
}

async function create(invitation, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.invitation_tokens (
        initiator_id,
        token,
        initiated_as,
        expiration_date,
        used,
        creation_date
      )
      VALUES ($1, $2, $3, $4, FALSE, NOW())
      RETURNING *
    `,
    [
      invitation.initiatorId,
      invitation.token,
      invitation.initiatedAs,
      invitation.expirationDate,
    ],
  );

  return mapInvitationToken(result.rows[0]);
}

async function findByToken(token, client = db, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM auth.invitation_tokens
      WHERE token = $1
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [token],
  );

  return mapInvitationToken(result.rows[0]);
}

async function markUsed(id, client = db) {
  const result = await client.query(
    `
      UPDATE auth.invitation_tokens
      SET used = TRUE
      WHERE id = $1
        AND used = FALSE
      RETURNING *
    `,
    [id],
  );

  return mapInvitationToken(result.rows[0]);
}

module.exports = {
  create,
  findByToken,
  mapInvitationToken,
  markUsed,
};
