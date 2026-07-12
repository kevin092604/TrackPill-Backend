const { z } = require('zod');

const EmailCredential = require('../models/email-credential.model');
const User = require('../models/user.model');
const { createHttpError, normalizeEmail } = require('../utils/helpers');
const storageService = require('./storage.service');

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/bmp', 'image/jpeg', 'image/png']);

const updateProfileSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Ingresa un correo valido.' }),
  firstName: z.string().trim().min(1, 'Ingresa tu nombre.').max(120, 'El nombre es demasiado largo.'),
  lastName: z.string().trim().min(1, 'Ingresa tu apellido.').max(120, 'El apellido es demasiado largo.'),
  phone: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 8, {
      message: 'Ingresa un telefono hondureno valido (+504 XXXX-XXXX).',
    }),
});

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
    photoUrl: user.photoUrl,
  };
}

async function updateProfile(userId, payload) {
  const result = updateProfileSchema.safeParse(payload);

  if (!result.success) {
    throw createHttpError(422, result.error.issues[0].message, 'validation_error');
  }

  const { email, firstName, lastName, phone } = result.data;
  const currentUser = await User.findById(userId);

  if (!currentUser) {
    throw createHttpError(404, 'Usuario no encontrado.', 'user_not_found');
  }

  const emailChanged = normalizeEmail(email) !== normalizeEmail(currentUser.email);

  if (emailChanged) {
    const existingUserByEmail = await User.findByEmail(email);

    if (existingUserByEmail && String(existingUserByEmail.id) !== String(userId)) {
      throw createHttpError(409, 'El correo ingresado ya esta registrado.', 'email_already_registered');
    }
  }

  if (phone !== String(currentUser.phone || '').replace(/\D/g, '')) {
    const existingUserByPhone = await User.findByPhone(phone);

    if (existingUserByPhone && String(existingUserByPhone.id) !== String(userId)) {
      throw createHttpError(409, 'El numero de telefono ya esta registrado en otra cuenta.', 'phone_already_registered');
    }
  }

  const updatedUser = await User.updateProfile(userId, {
    email,
    emailChanged,
    firstName,
    lastName,
    phone,
  });

  return getProfile(updatedUser.id);
}

async function uploadProfilePhoto(userId, file) {
  if (!file) {
    throw createHttpError(400, 'La foto de perfil es requerida.', 'missing_profile_photo');
  }

  if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(
      422,
      'Formato no soportado. Usa .png, .jpeg, .jpg o .bmp.',
      'invalid_photo_format',
    );
  }

  const photoUrl = await storageService.uploadPublicFile(`profile-photos/${userId}`, file);
  const updatedUser = await User.updatePhotoUrl(userId, photoUrl);

  return { photoUrl: updatedUser.photoUrl };
}

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
};
