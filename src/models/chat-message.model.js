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

module.exports = {
  create,
  findByConversationId,
};
