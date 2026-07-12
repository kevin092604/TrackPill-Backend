const db = require('../config/db');

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    active: row.active,
    address: row.address,
    birthDate: row.birth_date,
    creationDate: row.creation_date,
    email: row.email,
    emailVerified: row.email_verified,
    emailVerifiedDate: row.email_verified_date,
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
    'SELECT * FROM auth.users WHERE email = $1 LIMIT 1',
    [email],
  );

  return mapUser(result.rows[0]);
}

/**
 * Busca un usuario por su número de teléfono
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @date 2026/06/21
 */
async function findByPhone(phone, client = db) {
  const result = await client.query(
    'SELECT * FROM auth.users WHERE phone = $1 LIMIT 1',
    [phone],
  );

  return mapUser(result.rows[0]);
}

async function findById(id, client = db) {
  const result = await client.query(
    'SELECT * FROM auth.users WHERE id = $1 LIMIT 1',
    [id],
  );

  return mapUser(result.rows[0]);
}

async function create(user, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.users (
        email,
        first_name,
        last_name,
        active,
        email_verified,
        email_verified_date,
        phone,
        birth_date,
        gender,
        creation_date,
        last_update
      )
      VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `,
    [
      user.email,
      user.firstName,
      user.lastName,
      Boolean(user.emailVerified),
      user.emailVerified ? new Date() : null,
      user.phone,
      user.birthDate,
      user.gender,
    ],
  );

  return mapUser(result.rows[0]);
}

async function createSocialUser(user, client = db) {
  return create(user, client);
}

async function markEmailVerified(userId, client = db) {
  const result = await client.query(
    `
      UPDATE auth.users
      SET email_verified = TRUE,
          email_verified_date = COALESCE(email_verified_date, NOW()),
          last_update = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId],
  );

  return mapUser(result.rows[0]);
}

module.exports = {
  create,
  createSocialUser,
  findByEmail,
  findById,
  findByPhone,
  markEmailVerified,
  mapUser,
};

