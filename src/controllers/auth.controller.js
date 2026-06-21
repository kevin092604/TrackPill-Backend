const authService = require('../services/auth.service');

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
  socialCompleteRegister,
  socialAuth,
  socialRegister,
};
