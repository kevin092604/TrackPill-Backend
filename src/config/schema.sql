CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_date TIMESTAMPTZ,
  phone VARCHAR(40),
  birth_date DATE,
  gender VARCHAR(40)
);

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_verified_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS auth.provider_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  CONSTRAINT provider_types_name_check CHECK (name IN ('google', 'facebook', 'apple'))
);

CREATE TABLE IF NOT EXISTS auth.social_providers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_type_id BIGINT NOT NULL REFERENCES auth.provider_types(id),
  external_provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  provider_name VARCHAR(255),
  profile_picture TEXT,
  link_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_providers_provider_external_uk UNIQUE (provider_type_id, external_provider_id)
);

CREATE INDEX IF NOT EXISTS social_providers_user_provider_idx
  ON auth.social_providers (user_id, provider_type_id);

CREATE TABLE IF NOT EXISTS auth.pending_social_registrations (
  id BIGSERIAL PRIMARY KEY,
  provider_type_id BIGINT NOT NULL REFERENCES auth.provider_types(id),
  external_provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  provider_name VARCHAR(255),
  given_name VARCHAR(120),
  family_name VARCHAR(120),
  profile_picture TEXT,
  is_private_email BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  registration_token TEXT NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_social_registrations_provider_external_uk
    UNIQUE (provider_type_id, external_provider_id)
);

CREATE INDEX IF NOT EXISTS pending_social_registrations_active_idx
  ON auth.pending_social_registrations (provider_type_id, external_provider_id, used, expires_at);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(80),
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS auth.email_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hash_password TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_date TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth.verification_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  hash_code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expiration_date TIMESTAMPTZ NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verification_codes_type_check CHECK (type IN ('forgotten_password', 'email_verification'))
);

CREATE INDEX IF NOT EXISTS verification_codes_user_type_used_idx
  ON auth.verification_codes (user_id, type, used);

CREATE TABLE IF NOT EXISTS auth.caregiver_relationships (
  id BIGSERIAL PRIMARY KEY,
  caregiver_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_label VARCHAR(120),
  initiated_by VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  invitation_channel VARCHAR(20) NOT NULL,
  invitation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_date TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT caregiver_relationships_different_users_check
    CHECK (caregiver_id <> patient_id),
  CONSTRAINT caregiver_relationships_initiated_by_check
    CHECK (initiated_by IN ('caregiver', 'patient')),
  CONSTRAINT caregiver_relationships_status_check
    CHECK (status IN ('pendiente', 'aceptada', 'rechazada', 'eliminada')),
  CONSTRAINT caregiver_relationships_invitation_channel_check
    CHECK (invitation_channel IN ('busqueda', 'qr', 'enlace'))
);

ALTER TABLE auth.caregiver_relationships
  ADD COLUMN IF NOT EXISTS relationship_label VARCHAR(120);

ALTER TABLE auth.caregiver_relationships
  ADD COLUMN IF NOT EXISTS initiated_by VARCHAR(20);

ALTER TABLE auth.caregiver_relationships
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE auth.caregiver_relationships
  ADD COLUMN IF NOT EXISTS invitation_channel VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS caregiver_relationships_open_pair_uk
  ON auth.caregiver_relationships (
    LEAST(caregiver_id, patient_id),
    GREATEST(caregiver_id, patient_id)
  )
  WHERE status IN ('pendiente', 'aceptada');

CREATE INDEX IF NOT EXISTS caregiver_relationships_participants_idx
  ON auth.caregiver_relationships (caregiver_id, patient_id, status);

CREATE TABLE IF NOT EXISTS auth.invitation_tokens (
  id BIGSERIAL PRIMARY KEY,
  initiator_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  initiated_as VARCHAR(20) NOT NULL CHECK (initiated_as IN ('caregiver', 'patient')),
  expiration_date TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitation_tokens_active_idx
  ON auth.invitation_tokens (initiator_id, used, expiration_date);

INSERT INTO auth.provider_types (name)
VALUES ('google'), ('facebook'), ('apple')
ON CONFLICT (name) DO NOTHING;
