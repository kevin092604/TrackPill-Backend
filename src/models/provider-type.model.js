const db = require('../config/db');

function mapProviderType(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
  };
}

async function findOrCreateByName(name, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.provider_types (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
    `,
    [name],
  );

  return mapProviderType(result.rows[0]);
}

module.exports = {
  findOrCreateByName,
  mapProviderType,
};
