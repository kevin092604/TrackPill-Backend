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

function getJwtExpirationDate(token) {
  const decoded = jwt.decode(token);

  return decoded?.exp ? new Date(decoded.exp * 1000) : null;
}

function verifySocialRegistrationToken(token) {
  if (!token) {
    throw createHttpError(400, 'Token de registro social requerido.', 'missing_social_registration_token');
  }

  const secret = process.env.SOCIAL_REGISTRATION_SECRET || getRequiredEnv('JWT_SECRET');

  try {
    const decoded = jwt.verify(token, secret);

    if (decoded?.type !== 'social_registration') {
      throw createHttpError(
        401,
        'Token de registro social invalido.',
        'invalid_social_registration_token',
      );
    }

    return decoded;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.name === 'TokenExpiredError') {
      throw createHttpError(
        401,
        'El registro social expiro. Inicia sesion nuevamente.',
        'expired_social_registration_token',
      );
    }

    throw createHttpError(
      401,
      'Token de registro social invalido.',
      'invalid_social_registration_token',
    );
  }
}

module.exports = {
  createHttpError,
  getJwtExpirationDate,
  getRequiredEnv,
  normalizeEmail,
  signAuthToken,
  signSocialRegistrationToken,
  splitName,
  verifySocialRegistrationToken,
};
