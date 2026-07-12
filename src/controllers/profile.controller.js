const profileService = require('../services/profile.service');

async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.id);

    res.status(200).json({
      profile,
      success: true,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
};
