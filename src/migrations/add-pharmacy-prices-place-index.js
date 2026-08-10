const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    await clientOrPool.query(`
      CREATE INDEX IF NOT EXISTS pharmacy_prices_name_place_idx
      ON medicine_stock.pharmacy_prices (medicine_name_normalized, pharmacy_place_id);
    `);
    console.info('[MIGRATION] Índice pharmacy_prices_name_place_idx verificado/creado exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL pharmacy_prices_name_place_idx:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
