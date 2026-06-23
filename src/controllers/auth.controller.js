const authService = require('../services/auth.service');

/**
 * Controlador que maneja el registro de un usuario con correo y contraseña
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/06/21
 * @date 2026/06/21
 * @param {Object} req - Objeto con la solicitud.
 * @param {Object} res - Objeto con la respuesta.
 * @param {Function} next - Función para pasar el control a la siguiente función middleware.
 */
async function registerWithEmailAndPassword(req, res, next) {

  try {
    const result = await authService.registerWithEmailAndPassword(req.body);

    res.status(201).json(
      {
        success: true,
        ...result,
      }
    );
  } catch (error) {
    next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.verifyEmail({
      code: req.body?.code,
      email: req.body?.email,
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador que maneja el inicio de sesión con correo y contraseña
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/06/20
 * @date 2026/06/20
 * @param {Object} req - Objeto con la solicitud.
 * @param {Object} res - Objeto con la respuesta.
 * @param {Function} next - Función para pasar el control a la siguiente función middleware.
 */
async function authenticateWithEmailAndPassword(req, res, next) {

  try {
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const userAgent = req.headers['user-agent'];

    const result = await authService.authenticateWithEmailAndPassword(
      {
        email: req.body?.email,
        password: req.body?.password,
        ipAddress,
        userAgent
      }
    );

    res.status(200).json(
      {
        success: true,
        ...result
      }
    );

  } catch (error) {

    next(error)
  }
}
  
async function socialAuth(req, res, next) {
  try {
    console.info('[auth/social] request', {
      hasAccessToken: Boolean(req.body?.credential?.accessToken),
      hasAuthenticationToken: Boolean(req.body?.credential?.authenticationToken),
      platform: req.body?.platform,
      provider: req.body?.provider,
    });

    const result = await authService.authenticateSocialUser(req.body);

    console.info('[auth/social] success', {
      action: result.action,
      provider: req.body?.provider,
      status: result.status,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[auth/social] error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });

    next(error);
  }
}

async function socialRegister(req, res, next) {
  return socialCompleteRegister(req, res, next);
}

async function socialCompleteRegister(req, res, next) {
  try {
    const result = await authService.completeSocialRegistration(req.body);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function appleCallback(req, res, next) {
  try {
    const redirectUrl = authService.buildAppleCallbackRedirectUrl({
      ...req.query,
      ...req.body,
    });

    res.redirect(302, redirectUrl);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateWithEmailAndPassword,
  appleCallback,
  registerWithEmailAndPassword,
  socialCompleteRegister,
  socialAuth,
  socialRegister,
  verifyEmail,
};
