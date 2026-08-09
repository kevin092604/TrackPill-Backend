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
  gender VARCHAR(40),
  address VARCHAR(255),
  photo_url TEXT
);

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS address VARCHAR(255);

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_verified_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_phone_idx ON auth.users (phone);

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

CREATE SCHEMA IF NOT EXISTS medicine_stock;

CREATE TABLE IF NOT EXISTS medicine_stock.measurement_units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR (20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS medicine_stock.pharmaceutical_forms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  measurement_unit_id INT NOT NULL REFERENCES medicine_stock.measurement_units(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medicine_stock.time_units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS medicine_stock.movement_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  factor INT NOT NULL
);

INSERT INTO medicine_stock.measurement_units (name, code)
VALUES
  ('Miligramos', 'mg'),
  ('Mililitros', 'ml'),
  ('Microgramos', 'mcg'),
  ('Unidades internacionales', 'UI'),
  ('Gotas', 'gotas')
ON CONFLICT (code) DO NOTHING;

INSERT INTO medicine_stock.pharmaceutical_forms (name, measurement_unit_id)
SELECT v.name, mu.id
FROM (VALUES
  ('Comprimido', 'mg'),
  ('Cápsula', 'mg'),
  ('Jarabe', 'ml'),
  ('Inyección', 'ml'),
  ('Gotas', 'gotas'),
  ('Otro', 'mg')
) AS v(name, unit_code)
JOIN medicine_stock.measurement_units mu ON mu.code = v.unit_code
ON CONFLICT (name) DO NOTHING;

INSERT INTO medicine_stock.time_units (name, code)
VALUES
  ('Horas', 'horas'),
  ('Días', 'dias'),
  ('Semanas', 'semanas')
ON CONFLICT (code) DO NOTHING;

INSERT INTO medicine_stock.movement_types (name, factor)
VALUES
  ('toma', -1),
  ('ajuste_manual', 1),
  ('reposicion', 1)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS medicine_stock.schedules (
  id SERIAL PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  monday BOOLEAN NOT NULL DEFAULT FALSE,
  tuesday BOOLEAN NOT NULL DEFAULT FALSE,
  wednesday BOOLEAN NOT NULL DEFAULT FALSE,
  thursday BOOLEAN NOT NULL DEFAULT FALSE,
  friday BOOLEAN NOT NULL DEFAULT FALSE,
  saturday BOOLEAN NOT NULL DEFAULT FALSE,
  sunday BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS medicine_stock.medicines (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(255),
  pharmaceutical_form_id INT NOT NULL REFERENCES medicine_stock.pharmaceutical_forms(id) ON DELETE RESTRICT,
  current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  dose NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  frequency INT NOT NULL,
  time_unit_id INT NOT NULL REFERENCES medicine_stock.time_units(id) ON DELETE RESTRICT,
  start_time TIME NOT NULL,
  schedule_id INT NOT NULL REFERENCES medicine_stock.schedules(id) ON DELETE RESTRICT,
  description TEXT,
  low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  low_stock_threshold NUMERIC(10, 2) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medicine_stock.stock_movements (
  id SERIAL PRIMARY KEY,
  medicine_id BIGINT NOT NULL REFERENCES medicine_stock.medicines(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  movement_type_id INT NOT NULL REFERENCES medicine_stock.movement_types(id) ON DELETE RESTRICT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_stock.dose_status (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO medicine_stock.dose_status(id, name)
VALUES (1, 'Pendiente'), (2, 'Tomada'), (3, 'Retrasada'), (4, 'Omitida')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS medicine_stock.medication_logs (
  id BIGSERIAL PRIMARY KEY,
  medicine_id BIGINT NOT NULL REFERENCES medicine_stock.medicines(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  taken_time TIMESTAMPTZ,
  status_id INT NOT NULL REFERENCES medicine_stock.dose_status(id) ON DELETE RESTRICT,
  CONSTRAINT medication_log_unique_schedule UNIQUE (medicine_id, scheduled_time)
);

CREATE TABLE IF NOT EXISTS medicine_stock.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- usuario que recibe la notificación
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id BIGINT REFERENCES auth.users(id) ON DELETE CASCADE, -- paciente relacionado a la notificación
  medicine_id BIGINT REFERENCES medicine_stock.medicines(id) ON DELETE CASCADE,
  dose_id BIGINT REFERENCES medicine_stock.medication_logs(id) ON DELETE CASCADE,
  -- TODO: Agregar un check para verificar los tipos de notificaciones
  CONSTRAINT notifications_users_check CHECK (user_id <> patient_id) -- verifica que no sean la misma persona
);

ALTER TABLE medicine_stock.medicines
  ADD COLUMN IF NOT EXISTS low_stock_alert_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS medicine_stock.pharmacy_prices (
  id BIGSERIAL PRIMARY KEY,
  medicine_name_normalized VARCHAR(255) NOT NULL,
  pharmacy_place_id VARCHAR(255) NOT NULL,
  pharmacy_name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'HNL',
  country_code VARCHAR(5) NOT NULL DEFAULT 'HN',
  source VARCHAR(50) NOT NULL DEFAULT 'estimated',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_source CHECK (source IN ('real', 'crowd_sourced', 'estimated'))
);

CREATE INDEX IF NOT EXISTS pharmacy_prices_lookup_idx
  ON medicine_stock.pharmacy_prices (medicine_name_normalized, country_code);

-- HU-24: listas guardadas de medicamentos para comparar precios (SCRUM-144)
CREATE TABLE IF NOT EXISTS medicine_stock.saved_medicine_lists (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_medicine_lists_user_idx
  ON medicine_stock.saved_medicine_lists (user_id);

CREATE TABLE IF NOT EXISTS medicine_stock.saved_medicine_list_items (
  id BIGSERIAL PRIMARY KEY,
  list_id BIGINT NOT NULL REFERENCES medicine_stock.saved_medicine_lists(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_medicine_list_items_list_idx
  ON medicine_stock.saved_medicine_list_items (list_id);

-- HU-26 a HU-30: suscripciones, metodos de pago y facturacion
CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE IF NOT EXISTS billing.plans (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'HNL',
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'mensual',
  CONSTRAINT plans_billing_interval_check CHECK (billing_interval IN ('mensual', 'anual', 'ninguno'))
);

INSERT INTO billing.plans (code, name, price, currency, billing_interval)
VALUES
  ('free', 'Plan gratuito', 0.00, 'HNL', 'ninguno'),
  ('premium', 'Plan premium', 199.00, 'HNL', 'mensual')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id INT NOT NULL REFERENCES billing.plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'activa',
  autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  billing_name VARCHAR(180),
  billing_address VARCHAR(255),
  billing_city VARCHAR(120),
  billing_country VARCHAR(80),
  billing_tax_id VARCHAR(60),
  current_period_end TIMESTAMPTZ,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancellation_date TIMESTAMPTZ,
  CONSTRAINT subscriptions_status_check CHECK (status IN ('activa', 'cancelada'))
);

CREATE TABLE IF NOT EXISTS billing.payment_methods (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL DEFAULT 'manual',
  token_reference TEXT NOT NULL,
  brand VARCHAR(40),
  last4 VARCHAR(4),
  cardholder_name VARCHAR(180),
  expiration_month SMALLINT,
  expiration_year SMALLINT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_methods_user_idx
  ON billing.payment_methods (user_id) WHERE removed_date IS NULL;

CREATE TABLE IF NOT EXISTS billing.payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES billing.subscriptions(id) ON DELETE SET NULL,
  payment_method_id BIGINT REFERENCES billing.payment_methods(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'HNL',
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  description VARCHAR(255),
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_date TIMESTAMPTZ,
  CONSTRAINT payments_status_check CHECK (status IN ('pendiente', 'completado', 'fallido'))
);

CREATE INDEX IF NOT EXISTS payments_user_idx
  ON billing.payments (user_id, creation_date DESC);

-- Tuchi IA: chatbot con Amazon Bedrock (Claude)
CREATE SCHEMA IF NOT EXISTS assistant;

CREATE TABLE IF NOT EXISTS assistant.conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(120),
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_conversations_user_idx
  ON assistant.conversations (user_id, last_message_date DESC);

ALTER TABLE assistant.conversations
  ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS assistant_conversations_user_patient_idx
  ON assistant.conversations (user_id, patient_id, last_message_date DESC);

CREATE TABLE IF NOT EXISTS assistant.messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES assistant.conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assistant_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS assistant_messages_conversation_idx
  ON assistant.messages (conversation_id, creation_date ASC);
