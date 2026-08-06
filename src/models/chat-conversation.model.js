const db = require('../config/db');

function mapConversation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    patientId: row.patient_id,
    title: row.title,
    createdAt: row.creation_date,
    lastMessageAt: row.last_message_date,
  };
}

async function create(userId, title, patientId, client = db) {
  const result = await client.query(
    `INSERT INTO assistant.conversations (user_id, title, patient_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, title || null, patientId || null],
  );

  return mapConversation(result.rows[0]);
}

async function findByIdForUser(id, userId, client = db) {
  const result = await client.query(
    `SELECT * FROM assistant.conversations WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );

  return mapConversation(result.rows[0]);
}

async function findAllByUserId(userId, patientId, client = db) {
  const result = await client.query(
    `SELECT * FROM assistant.conversations
     WHERE user_id = $1
       AND patient_id IS NOT DISTINCT FROM $2
     ORDER BY last_message_date DESC`,
    [userId, patientId || null],
  );

  return result.rows.map(mapConversation);
}

async function touch(id, client = db) {
  await client.query(
    `UPDATE assistant.conversations SET last_message_date = NOW() WHERE id = $1`,
    [id],
  );
}

module.exports = {
  create,
  findByIdForUser,
  findAllByUserId,
  touch,
};
