const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS medicine_stock.pharmacy_favorites (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        pharmacy_place_id VARCHAR(255) NOT NULL,
        pharmacy_name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        latitude NUMERIC(10, 6),
        longitude NUMERIC(10, 6),
        country_code VARCHAR(5) NOT NULL DEFAULT 'HN',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pharmacy_favorites_user_place_unique UNIQUE (user_id, pharmacy_place_id)
      );
    `);
    await clientOrPool.query(`
      CREATE INDEX IF NOT EXISTS pharmacy_favorites_user_idx
      ON medicine_stock.pharmacy_favorites (user_id);
    `);
    console.info('[MIGRATION] Tabla pharmacy_favorites verificada/creada exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL pharmacy_favorites:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
