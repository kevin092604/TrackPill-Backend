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

async function updateProfile(req, res, next) {
  try {
    const profile = await profileService.updateProfile(req.user.id, req.body);

    res.status(200).json({
      profile,
      success: true,
    });
  } catch (error) {
    next(error);
  }
}

async function uploadPhoto(req, res, next) {
  try {
    const result = await profileService.uploadProfilePhoto(req.user.id, req.file);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
};
