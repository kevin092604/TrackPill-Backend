const db = require('../config/db');

function mapMessage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.creation_date,
  };
}

async function create(conversationId, role, content, client = db) {
  const result = await client.query(
    `INSERT INTO assistant.messages (conversation_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [conversationId, role, content],
  );

  return mapMessage(result.rows[0]);
}

async function findByConversationId(conversationId, client = db) {
  const result = await client.query(
    `SELECT * FROM assistant.messages WHERE conversation_id = $1 ORDER BY creation_date ASC`,
    [conversationId],
  );

  return result.rows.map(mapMessage);
}

/**
 * Cuenta los mensajes enviados hoy (UTC) por un usuario, a traves de todas sus
 * conversaciones, para aplicar el limite diario del plan gratuito.
 */
async function countUserMessagesToday(userId, client = db) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM assistant.messages m
     JOIN assistant.conversations c ON m.conversation_id = c.id
     WHERE c.user_id = $1
       AND m.role = 'user'
       AND m.creation_date >= date_trunc('day', NOW())`,
    [userId],
  );

  return result.rows[0]?.count || 0;
}

module.exports = {
  create,
  findByConversationId,
  countUserMessagesToday,
};
