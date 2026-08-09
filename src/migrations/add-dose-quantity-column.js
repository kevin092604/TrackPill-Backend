const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    await clientOrPool.query(`
      ALTER TABLE medicine_stock.medicines 
      ADD COLUMN IF NOT EXISTS dose_quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00;
    `);
    console.info('[MIGRATION] Columna dose_quantity verificada/creada exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL dose_quantity:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
