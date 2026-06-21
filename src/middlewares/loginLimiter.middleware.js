const rateLimit = require('express-rate-limit');
const { createHttpError } = require('../utils/helpers');

/**
 * Middleware para bloquear intentos de inicio de sesión por fuerza bruta.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/06/20
 * @date 2026/06/20
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, 
  handler: (req, res, next) => {
    next(createHttpError(
        429, 
        "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
        "too_many_requests")
    );
  },
  standardHeaders: true, 
  legacyHeaders: false,
});

module.exports = loginLimiter;