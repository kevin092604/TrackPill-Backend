const db = require('../config/db');

function mapList(row, items = []) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    creationDate: row.creation_date,
    lastUpdate: row.last_update,
    items: items.map((item) => ({ id: item.id, medicineName: item.medicine_name })),
  };
}

async function findByUserId(userId, client = db) {
  const listsResult = await client.query(
    `SELECT * FROM medicine_stock.saved_medicine_lists
     WHERE user_id = $1
     ORDER BY last_update DESC`,
    [userId],
  );

  const lists = listsResult.rows;
  if (lists.length === 0) return [];

  const itemsResult = await client.query(
    `SELECT * FROM medicine_stock.saved_medicine_list_items
     WHERE list_id = ANY($1::bigint[])
     ORDER BY creation_date ASC`,
    [lists.map((l) => l.id)],
  );

  const itemsByList = new Map();
  for (const item of itemsResult.rows) {
    if (!itemsByList.has(item.list_id)) itemsByList.set(item.list_id, []);
    itemsByList.get(item.list_id).push(item);
  }

  return lists.map((row) => mapList(row, itemsByList.get(row.id) || []));
}

async function findById(id, client = db) {
  const listResult = await client.query(
    'SELECT * FROM medicine_stock.saved_medicine_lists WHERE id = $1',
    [id],
  );
  const row = listResult.rows[0];
  if (!row) return null;

  const itemsResult = await client.query(
    `SELECT * FROM medicine_stock.saved_medicine_list_items
     WHERE list_id = $1
     ORDER BY creation_date ASC`,
    [id],
  );

  return mapList(row, itemsResult.rows);
}

async function create(userId, name, medicineNames, client = db) {
  return db.transaction(async (tx) => {
    const listResult = await tx.query(
      `INSERT INTO medicine_stock.saved_medicine_lists (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, name],
    );
    const list = listResult.rows[0];

    for (const medicineName of medicineNames) {
      await tx.query(
        `INSERT INTO medicine_stock.saved_medicine_list_items (list_id, medicine_name)
         VALUES ($1, $2)`,
        [list.id, medicineName],
      );
    }

    return findById(list.id, tx);
  });
}

async function update(id, name, medicineNames, client = db) {
  return db.transaction(async (tx) => {
    await tx.query(
      `UPDATE medicine_stock.saved_medicine_lists
       SET name = $2, last_update = NOW()
       WHERE id = $1`,
      [id, name],
    );

    if (medicineNames) {
      await tx.query('DELETE FROM medicine_stock.saved_medicine_list_items WHERE list_id = $1', [id]);

      for (const medicineName of medicineNames) {
        await tx.query(
          `INSERT INTO medicine_stock.saved_medicine_list_items (list_id, medicine_name)
           VALUES ($1, $2)`,
          [id, medicineName],
        );
      }
    }

    return findById(id, tx);
  });
}

async function remove(id, client = db) {
  await client.query('DELETE FROM medicine_stock.saved_medicine_lists WHERE id = $1', [id]);
}

module.exports = {
  findByUserId,
  findById,
  create,
  update,
  remove,
};
