const jwt = require('jsonwebtoken');
const Session = require('../models/session.model');
const User = require('../models/user.model');

const { createHttpError, getRequiredEnv } = require('../utils/helpers');

/**
 * Función que permite verificar la validez de un token de acceso.
 * @author Kevin García, Jesús Zepeda
 * @version 0.3.0
 * @since 2026/06/19
 * @date 2026/06/22
 * @param {Object} req - Objeto de petición.
 * @param {Object} req.headers - Objeto de cabeceras.
 * @param {string} req.headers.authorization - Cabecera de autorización.
 * @param {Object} _res - Objeto de respuesta.
 * @param {Function} next - Función para continuar con la siguiente petición.
 * @returns {void} No retorna ningún valor.
 */
async function authMiddleware(req, _res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw createHttpError(401, 'Token de autenticación requerido.', 'missing_auth_token');
    }

    const decoded = jwt.verify(token, getRequiredEnv('JWT_SECRET'));

    const user = await User.findById(decoded.sub);

    if (!user || !user.active) {
      throw createHttpError(401, 'Usuario no encontrado o inactivo.', 'inactive_user');
    }

    if (decoded.sid) {
      const session = await Session.findById(decoded.sid);

      if (!session || !session.active) {
        throw createHttpError(401, 'Sesión expirada o revocada', 'revoked_session');
      }

      req.sessionId = session.id;
    }

    req.auth = decoded;
    req.user = user;
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
