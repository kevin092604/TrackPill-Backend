const db = require('../config/db');

function mapFavorite(row) {
  return {
    id: row.id,
    userId: row.user_id,
    placeId: row.pharmacy_place_id,
    name: row.pharmacy_name,
    address: row.address,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    countryCode: row.country_code,
    createdAt: row.creation_date,
  };
}

async function findByUserId(userId) {
  const result = await db.query(
    `SELECT * FROM medicine_stock.pharmacy_favorites
     WHERE user_id = $1
     ORDER BY creation_date DESC`,
    [userId],
  );

  return result.rows.map(mapFavorite);
}

async function create(userId, pharmacy) {
  const result = await db.query(
    `INSERT INTO medicine_stock.pharmacy_favorites
       (user_id, pharmacy_place_id, pharmacy_name, address, latitude, longitude, country_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, pharmacy_place_id) DO UPDATE SET
       pharmacy_name = EXCLUDED.pharmacy_name,
       address = EXCLUDED.address,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       country_code = EXCLUDED.country_code
     RETURNING *`,
    [
      userId,
      pharmacy.placeId,
      pharmacy.name,
      pharmacy.address || null,
      pharmacy.latitude ?? null,
      pharmacy.longitude ?? null,
      pharmacy.countryCode || 'HN',
    ],
  );

  return mapFavorite(result.rows[0]);
}

async function remove(userId, placeId) {
  await db.query(
    `DELETE FROM medicine_stock.pharmacy_favorites
     WHERE user_id = $1 AND pharmacy_place_id = $2`,
    [userId, placeId],
  );
}

module.exports = {
  findByUserId,
  create,
  remove,
};
