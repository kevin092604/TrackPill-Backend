CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phone VARCHAR(40),
  birth_date DATE,
  gender VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS provider_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  CONSTRAINT provider_types_name_check CHECK (name IN ('google', 'facebook', 'apple'))
);

CREATE TABLE IF NOT EXISTS social_providers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type_id BIGINT NOT NULL REFERENCES provider_types(id),
  external_provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  provider_name VARCHAR(255),
  profile_picture TEXT,
  link_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_providers_provider_external_uk UNIQUE (provider_type_id, external_provider_id)
);

CREATE INDEX IF NOT EXISTS social_providers_user_provider_idx
  ON social_providers (user_id, provider_type_id);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(80),
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS email_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  hash_password TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_date TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  hash_code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expiration_date TIMESTAMPTZ NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verification_codes_type_check CHECK (type IN ('forgotten_password', 'email_verification'))
);

CREATE INDEX IF NOT EXISTS verification_codes_user_type_used_idx
  ON verification_codes (user_id, type, used);

INSERT INTO provider_types (name)
VALUES ('google'), ('facebook'), ('apple')
ON CONFLICT (name) DO NOTHING;
