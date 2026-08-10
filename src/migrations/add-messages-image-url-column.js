const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    await clientOrPool.query(`
      ALTER TABLE assistant.messages
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);
    `);
    console.info('[MIGRATION] Columna image_url en assistant.messages verificada/creada exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL messages.image_url:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
