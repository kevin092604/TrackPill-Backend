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

INSERT INTO auth.provider_types (name)
VALUES ('google'), ('facebook'), ('apple')
ON CONFLICT (name) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS medication;

CREATE TABLE IF NOT EXISTS medication.medications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  pharmaceutical_form VARCHAR(60) NOT NULL,
  dose_amount NUMERIC(10, 2) NOT NULL,
  dose_unit VARCHAR(20) NOT NULL,
  photo_url TEXT,
  frequency_type VARCHAR(20) NOT NULL,
  current_inventory INTEGER NOT NULL DEFAULT 0,
  low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  low_stock_threshold INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT medications_frequency_type_check
    CHECK (frequency_type IN ('8h', '12h', '24h', 'custom')),
  CONSTRAINT medications_dose_amount_check CHECK (dose_amount > 0),
  CONSTRAINT medications_current_inventory_check CHECK (current_inventory >= 0)
);

CREATE INDEX IF NOT EXISTS medications_user_active_idx
  ON medication.medications (user_id, active);

CREATE TABLE IF NOT EXISTS medication.dose_schedules (
  id BIGSERIAL PRIMARY KEY,
  medication_id BIGINT NOT NULL REFERENCES medication.medications(id) ON DELETE CASCADE,
  scheduled_time TIME NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dose_schedules_medication_idx
  ON medication.dose_schedules (medication_id);
