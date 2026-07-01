const db = require('../config/db');
const { mapUser } = require('./user.model');

function mapSocialProvider(row) {
  if (!row) {
    return null;
  }

  return {
    externalProviderId: row.external_provider_id,
    id: row.id,
    lastSync: row.last_sync,
    linkDate: row.link_date,
    profilePicture: row.profile_picture,
    providerEmail: row.provider_email,
    providerName: row.provider_name,
    providerTypeId: row.provider_type_id,
    user: row.email ? mapUser({ ...row, id: row.user_id }) : null,
    userId: row.user_id,
  };
}

async function findByProviderAndExternalId(providerTypeId, externalProviderId, client = db) {
  const result = await client.query(
    `
      SELECT
        sp.*,
        u.email,
        u.first_name,
        u.last_name,
        u.creation_date,
        u.active,
        u.last_update,
        u.email_verified,
        u.email_verified_date,
        u.phone,
        u.birth_date,
        u.gender
      FROM auth.social_providers sp
      INNER JOIN auth.users u ON u.id = sp.user_id
      WHERE sp.provider_type_id = $1
        AND sp.external_provider_id = $2
      LIMIT 1
    `,
    [providerTypeId, externalProviderId],
  );

  return mapSocialProvider(result.rows[0]);
}

async function createOrUpdateLink(userId, providerTypeId, profile, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.social_providers (
        user_id,
        provider_type_id,
        external_provider_id,
        provider_email,
        provider_name,
        profile_picture,
        link_date,
        last_sync
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (provider_type_id, external_provider_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        provider_email = EXCLUDED.provider_email,
        provider_name = EXCLUDED.provider_name,
        profile_picture = EXCLUDED.profile_picture,
        last_sync = NOW()
      RETURNING *
    `,
    [
      userId,
      providerTypeId,
      profile.providerUserId,
      profile.email,
      profile.name,
      profile.photo,
    ],
  );

  return mapSocialProvider(result.rows[0]);
}

async function syncProfile(id, profile, client = db) {
  const result = await client.query(
    `
      UPDATE auth.social_providers
      SET
        provider_email = COALESCE($2, provider_email),
        provider_name = COALESCE($3, provider_name),
        profile_picture = COALESCE($4, profile_picture),
        last_sync = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, profile.email, profile.name, profile.photo],
  );

  return mapSocialProvider(result.rows[0]);
}

async function findProviderNamesByUserId(userId, client = db) {
  const result = await client.query(
    `
      SELECT pt.name
      FROM auth.social_providers sp
      INNER JOIN auth.provider_types pt ON pt.id = sp.provider_type_id
      WHERE sp.user_id = $1
      ORDER BY pt.name
    `,
    [userId],
  );

  return result.rows.map((row) => row.name);
}

module.exports = {
  createOrUpdateLink,
  findByProviderAndExternalId,
  findProviderNamesByUserId,
  mapSocialProvider,
  syncProfile,
};
