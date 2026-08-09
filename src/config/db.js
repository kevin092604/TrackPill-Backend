const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalDatabase = /@(localhost|127\.0\.0\.1)(:\d+)?\//i.test(databaseUrl);
const useSsl = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === 'true'
  : !isLocalDatabase;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function connectDB() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada.');
  }

  const client = await pool.connect();
  try {
    const runMigration = require('../migrations/add-dose-quantity-column');
    await runMigration(client);
  } finally {
    client.release();
  }
}

function query(text, params) {
  return pool.query(text, params);
}

async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  connectDB,
  pool,
  query,
  transaction,
};
