const db = require('../config/db');

function mapLocation(row) {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    isDefault: row.is_default,
    creationDate: row.creation_date,
  };
}

async function findByUserId(userId) {
  const result = await db.query(
    `SELECT * FROM medicine_stock.saved_locations
     WHERE user_id = $1
     ORDER BY is_default DESC, creation_date ASC`,
    [userId],
  );

  return result.rows.map(mapLocation);
}

async function findById(id) {
  const result = await db.query('SELECT * FROM medicine_stock.saved_locations WHERE id = $1', [id]);
  return result.rows[0] ? mapLocation(result.rows[0]) : null;
}

async function create(userId, location) {
  return db.transaction(async (tx) => {
    if (location.isDefault) {
      await tx.query(
        'UPDATE medicine_stock.saved_locations SET is_default = FALSE WHERE user_id = $1',
        [userId],
      );
    }

    const result = await tx.query(
      `INSERT INTO medicine_stock.saved_locations (user_id, label, address, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, location.label, location.address || null, location.latitude, location.longitude, !!location.isDefault],
    );

    return mapLocation(result.rows[0]);
  });
}

async function remove(userId, id) {
  await db.query(
    'DELETE FROM medicine_stock.saved_locations WHERE user_id = $1 AND id = $2',
    [userId, id],
  );
}

module.exports = {
  findByUserId,
  findById,
  create,
  remove,
};
