const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS medicine_stock.pharmacy_search_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        search_term VARCHAR(255) NOT NULL,
        searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await clientOrPool.query(`
      CREATE INDEX IF NOT EXISTS pharmacy_search_history_user_idx
      ON medicine_stock.pharmacy_search_history (user_id, searched_at DESC);
    `);
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS medicine_stock.saved_locations (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        label VARCHAR(120) NOT NULL,
        address VARCHAR(500),
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await clientOrPool.query(`
      CREATE INDEX IF NOT EXISTS saved_locations_user_idx
      ON medicine_stock.saved_locations (user_id);
    `);
    console.info('[MIGRATION] Tablas pharmacy_search_history y saved_locations verificadas/creadas exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL search_history/saved_locations:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
