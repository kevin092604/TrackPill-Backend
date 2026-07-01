const jwt = require('jsonwebtoken');

const { createHttpError, getRequiredEnv } = require('../utils/helpers');

function authMiddleware(req, _res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw createHttpError(401, 'Token de autenticacion requerido.', 'missing_auth_token');
    }

    req.auth = jwt.verify(token, getRequiredEnv('JWT_SECRET'));
    next();
  } catch (error) {
    next(
      error.statusCode
        ? error
        : createHttpError(401, 'Token de autenticacion invalido.', 'invalid_auth_token'),
    );
  }
}

module.exports = authMiddleware;
