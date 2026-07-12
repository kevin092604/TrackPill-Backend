const EmailCredential = require('../models/email-credential.model');
const User = require('../models/user.model');
const { createHttpError } = require('../utils/helpers');

async function getProfile(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw createHttpError(404, 'Usuario no encontrado.', 'user_not_found');
  }

  const credential = await EmailCredential.findByUserId(userId);

  return {
    address: user.address,
    birthDate: user.birthDate,
    email: user.email,
    firstName: user.firstName,
    gender: user.gender,
    hasPassword: Boolean(credential?.hashPassword),
    lastName: user.lastName,
    phone: user.phone,
  };
}

module.exports = {
  getProfile,
};
