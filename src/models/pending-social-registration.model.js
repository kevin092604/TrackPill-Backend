const db = require('../config/db');

function mapPendingSocialRegistration(row) {
  if (!row) {
    return null;
  }

  return {
    creationDate: row.creation_date,
    emailVerified: row.email_verified,
    expiresAt: row.expires_at,
    externalProviderId: row.external_provider_id,
    familyName: row.family_name,
    givenName: row.given_name,
    id: row.id,
    isPrivateEmail: row.is_private_email,
    lastUpdate: row.last_update,
    profilePicture: row.profile_picture,
    provider: row.provider,
    providerEmail: row.provider_email,
    providerName: row.provider_name,
    providerTypeId: row.provider_type_id,
    registrationToken: row.registration_token,
    used: row.used,
  };
}

async function findActiveByRegistrationToken(registrationToken, client = db) {
  const result = await client.query(
    `
      SELECT psr.*, pt.name AS provider
      FROM pending_social_registrations psr
      INNER JOIN provider_types pt ON pt.id = psr.provider_type_id
      WHERE psr.registration_token = $1
        AND psr.used = FALSE
        AND psr.expires_at > NOW()
      LIMIT 1
    `,
    [registrationToken],
  );

  return mapPendingSocialRegistration(result.rows[0]);
}

async function findReusableByProvider(providerTypeId, externalProviderId, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM pending_social_registrations
      WHERE provider_type_id = $1
        AND external_provider_id = $2
        AND used = FALSE
      LIMIT 1
    `,
    [providerTypeId, externalProviderId],
  );

  return mapPendingSocialRegistration(result.rows[0]);
}

async function upsertPending(providerTypeId, profile, registrationToken, expiresAt, client = db) {
  const result = await client.query(
    `
      INSERT INTO pending_social_registrations (
        provider_type_id,
        external_provider_id,
        provider_email,
        provider_name,
        given_name,
        family_name,
        profile_picture,
        is_private_email,
        email_verified,
        registration_token,
        used,
        expires_at,
        creation_date,
        last_update
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, NOW(), NOW())
      ON CONFLICT (provider_type_id, external_provider_id)
      DO UPDATE SET
        provider_email = COALESCE(EXCLUDED.provider_email, pending_social_registrations.provider_email),
        provider_name = COALESCE(EXCLUDED.provider_name, pending_social_registrations.provider_name),
        given_name = COALESCE(EXCLUDED.given_name, pending_social_registrations.given_name),
        family_name = COALESCE(EXCLUDED.family_name, pending_social_registrations.family_name),
        profile_picture = COALESCE(EXCLUDED.profile_picture, pending_social_registrations.profile_picture),
        is_private_email = CASE
          WHEN EXCLUDED.provider_email IS NOT NULL THEN EXCLUDED.is_private_email
          ELSE pending_social_registrations.is_private_email
        END,
        email_verified = CASE
          WHEN EXCLUDED.provider_email IS NOT NULL THEN EXCLUDED.email_verified
          ELSE pending_social_registrations.email_verified
        END,
        registration_token = EXCLUDED.registration_token,
        used = FALSE,
        expires_at = EXCLUDED.expires_at,
        last_update = NOW()
      RETURNING *
    `,
    [
      providerTypeId,
      profile.providerUserId,
      profile.email,
      profile.name,
      profile.givenName,
      profile.familyName,
      profile.photo,
      Boolean(profile.isPrivateEmail),
      Boolean(profile.emailVerified),
      registrationToken,
      expiresAt,
    ],
  );

  return mapPendingSocialRegistration(result.rows[0]);
}

async function markUsed(registrationToken, client = db) {
  const result = await client.query(
    `
      UPDATE pending_social_registrations
      SET used = TRUE,
          last_update = NOW()
      WHERE registration_token = $1
      RETURNING *
    `,
    [registrationToken],
  );

  return mapPendingSocialRegistration(result.rows[0]);
}

module.exports = {
  findActiveByRegistrationToken,
  findReusableByProvider,
  mapPendingSocialRegistration,
  markUsed,
  upsertPending,
};
