const jwt = require('jsonwebtoken');

function createHttpError(statusCode, message, code, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw createHttpError(
      500,
      `Variable de entorno requerida no configurada: ${name}`,
      'missing_environment_variable',
    );
  }

  return value;
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function splitName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function signAuthToken(user) {
  const secret = getRequiredEnv('JWT_SECRET');

  return jwt.sign(
    {
      email: user.email,
      sub: String(user.id),
      type: 'auth',
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

function signSocialRegistrationToken(payload) {
  const secret = process.env.SOCIAL_REGISTRATION_SECRET || getRequiredEnv('JWT_SECRET');

  return jwt.sign(
    {
      ...payload,
      type: 'social_registration',
    },
    secret,
    { expiresIn: process.env.SOCIAL_REGISTRATION_EXPIRES_IN || '30m' },
  );
}

module.exports = {
  createHttpError,
  getRequiredEnv,
  normalizeEmail,
  signAuthToken,
  signSocialRegistrationToken,
  splitName,
};
