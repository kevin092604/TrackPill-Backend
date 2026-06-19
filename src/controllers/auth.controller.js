const authService = require('../services/auth.service');

async function socialAuth(req, res, next) {
  try {
    const result = await authService.authenticateSocialUser(req.body);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function socialRegister(req, res, next) {
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

module.exports = {
  socialAuth,
  socialRegister,
};
