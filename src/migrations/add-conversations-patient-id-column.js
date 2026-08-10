const { pool } = require('../config/db');

async function runMigration(clientOrPool = pool) {
  try {
    // Defensivo: si el esquema/tabla base de assistant.conversations nunca se
    // aplicó (schema.sql no se ejecuta automáticamente), se crea aquí también.
    await clientOrPool.query('CREATE SCHEMA IF NOT EXISTS assistant;');
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS assistant.conversations (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        title VARCHAR(120),
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_message_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await clientOrPool.query(`
      ALTER TABLE assistant.conversations
      ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES auth.users(id) ON DELETE CASCADE;
    `);
    await clientOrPool.query(`
      CREATE INDEX IF NOT EXISTS assistant_conversations_user_patient_idx
      ON assistant.conversations (user_id, patient_id, last_message_date DESC);
    `);
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS assistant.messages (
        id BIGSERIAL PRIMARY KEY,
        conversation_id BIGINT NOT NULL REFERENCES assistant.conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT assistant_messages_role_check CHECK (role IN ('user', 'assistant'))
      );
    `);
    console.info('[MIGRATION] Columna patient_id en assistant.conversations verificada/creada exitosamente.');
  } catch (error) {
    console.error('[MIGRATION] Error al ejecutar migración DDL conversations.patient_id:', error);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => pool.end().finally(() => process.exit(1)));
}

module.exports = runMigration;
