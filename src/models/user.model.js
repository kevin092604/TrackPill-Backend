const db = require('../config/db');

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    active: row.active,
    birthDate: row.birth_date,
    creationDate: row.creation_date,
    email: row.email,
    firstName: row.first_name,
    gender: row.gender,
    id: row.id,
    lastName: row.last_name,
    lastUpdate: row.last_update,
    phone: row.phone,
  };
}

async function findByEmail(email, client = db) {
  const result = await client.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email],
  );

  return mapUser(result.rows[0]);
}

async function findById(id, client = db) {
  const result = await client.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id],
  );

  return mapUser(result.rows[0]);
}

module.exports = {
  findByEmail,
  findById,
  mapUser,
};
