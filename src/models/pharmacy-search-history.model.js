const db = require('../config/db');

function mapEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    searchTerm: row.search_term,
    searchedAt: row.searched_at,
  };
}

async function findByUserId(userId, limit = 20) {
  const result = await db.query(
    `SELECT DISTINCT ON (search_term) *
     FROM medicine_stock.pharmacy_search_history
     WHERE user_id = $1
     ORDER BY search_term, searched_at DESC`,
    [userId],
  );

  return result.rows
    .map(mapEntry)
    .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))
    .slice(0, limit);
}

async function create(userId, searchTerm) {
  const result = await db.query(
    `INSERT INTO medicine_stock.pharmacy_search_history (user_id, search_term)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, searchTerm],
  );

  return mapEntry(result.rows[0]);
}

async function remove(userId, id) {
  await db.query(
    `DELETE FROM medicine_stock.pharmacy_search_history
     WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
}

async function clear(userId) {
  await db.query(
    'DELETE FROM medicine_stock.pharmacy_search_history WHERE user_id = $1',
    [userId],
  );
}

module.exports = {
  findByUserId,
  create,
  remove,
  clear,
};
