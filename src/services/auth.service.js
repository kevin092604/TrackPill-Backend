const db = require('../config/db');
const PendingSocialRegistration = require('../models/pending-social-registration.model');
const ProviderType = require('../models/provider-type.model');
const SocialProvider = require('../models/social-provider.model');
const User = require('../models/user.model');
const socialProviderService = require('./social-provider.service');
const {
  createHttpError,
  getJwtExpirationDate,
  normalizeEmail,
  signAuthToken,
  signSocialRegistrationToken,
  splitName,
  verifySocialRegistrationToken,
} = require('../utils/helpers');

const GENDERS = new Set(['female', 'male', 'other', 'prefer_not_to_say']);

async function authenticateSocialUser(payload) {
  const provider = socialProviderService.normalizeProvider(payload?.provider);
  const credential = payload?.credential || {};

  if (!provider) {
    throw createHttpError(400, 'Proveedor social requerido.', 'missing_social_provider');
  }

  if (!Object.keys(credential).length) {
    throw createHttpError(400, 'Credencial social requerida.', 'missing_social_credential');
  }

  const providerType = await ProviderType.findOrCreateByName(provider);
  const providerProfile = await socialProviderService.verifyProviderCredential(provider, credential);
  const profile = mergeProviderProfile(providerProfile, payload?.profile);
  const existingSocialProvider = await SocialProvider.findByProviderAndExternalId(
    providerType.id,
    profile.providerUserId,
  );

  if (existingSocialProvider?.user) {
    ensureActiveUser(existingSocialProvider.user);
    await SocialProvider.syncProfile(existingSocialProvider.id, profile);

    return buildLoggedInResponse('login_direct', existingSocialProvider.user, [provider]);
  }

  const pendingRegistration = await PendingSocialRegistration.findReusableByProvider(
    providerType.id,
    profile.providerUserId,
  );
  const profileWithStoredProviderData = mergePendingProviderProfile(profile, pendingRegistration);
  const providerEmail = canUseEmailForAccountMatch(profileWithStoredProviderData)
    ? normalizeEmail(profileWithStoredProviderData.email)
    : null;
  const userByEmail = providerEmail
    ? await User.findByEmail(providerEmail)
    : null;

  if (userByEmail) {
    ensureActiveUser(userByEmail);
    await SocialProvider.createOrUpdateLink(
      userByEmail.id,
      providerType.id,
      profileWithStoredProviderData,
    );
    if (pendingRegistration?.registrationToken) {
      await PendingSocialRegistration.markUsed(pendingRegistration.registrationToken);
    }

    return buildLoggedInResponse(
      'linked_existing_account',
      userByEmail,
      await SocialProvider.findProviderNamesByUserId(userByEmail.id),
    );
  }

  return persistAndBuildRegistrationPendingResponse(providerType.id, profileWithStoredProviderData);
}

async function completeSocialRegistration(payload) {
  const registrationToken = payload?.registrationToken;
  const tokenPayload = verifySocialRegistrationToken(registrationToken);
  const pendingRegistration = await PendingSocialRegistration.findActiveByRegistrationToken(
    registrationToken,
  );

  if (!pendingRegistration) {
    throw createHttpError(
      401,
      'El registro social expiro. Inicia sesion nuevamente.',
      'expired_social_registration',
    );
  }

  ensureRegistrationTokenMatchesPending(tokenPayload, pendingRegistration);

  const userInput = normalizeSocialRegistrationUser(payload?.user, pendingRegistration);
  const linkProfile = buildProfileFromPendingRegistration(pendingRegistration, userInput);

  return db.transaction(async (client) => {
    const existingSocialProvider = await SocialProvider.findByProviderAndExternalId(
      pendingRegistration.providerTypeId,
      pendingRegistration.externalProviderId,
      client,
    );

    if (existingSocialProvider?.user) {
      ensureActiveUser(existingSocialProvider.user);
      await SocialProvider.syncProfile(existingSocialProvider.id, linkProfile, client);
      await PendingSocialRegistration.markUsed(registrationToken, client);

      return buildLoggedInResponse(
        'login_direct',
        existingSocialProvider.user,
        await SocialProvider.findProviderNamesByUserId(existingSocialProvider.user.id, client),
      );
    }

    const existingUser = await User.findByEmail(userInput.email, client);

    if (existingUser) {
      if (!userInput.emailVerified) {
        throw createHttpError(
          409,
          'El correo ingresado ya esta registrado. Inicia sesion con tu cuenta existente.',
          'email_already_registered',
        );
      }

      ensureActiveUser(existingUser);
      await SocialProvider.createOrUpdateLink(
        existingUser.id,
        pendingRegistration.providerTypeId,
        linkProfile,
        client,
      );
      await PendingSocialRegistration.markUsed(registrationToken, client);

      return buildLoggedInResponse(
        'linked_existing_account',
        existingUser,
        await SocialProvider.findProviderNamesByUserId(existingUser.id, client),
      );
    }

    const user = await User.createSocialUser(userInput, client);

    await SocialProvider.createOrUpdateLink(
      user.id,
      pendingRegistration.providerTypeId,
      linkProfile,
      client,
    );
    await PendingSocialRegistration.markUsed(registrationToken, client);

    return buildLoggedInResponse(
      'registered_social_account',
      user,
      await SocialProvider.findProviderNamesByUserId(user.id, client),
    );
  });
}

function ensureRegistrationTokenMatchesPending(tokenPayload, pendingRegistration) {
  if (
    tokenPayload.provider !== pendingRegistration.provider ||
    String(tokenPayload.providerUserId) !== String(pendingRegistration.externalProviderId)
  ) {
    throw createHttpError(
      401,
      'Token de registro social invalido.',
      'invalid_social_registration_token',
    );
  }
}

function normalizeSocialRegistrationUser(user = {}, pendingRegistration) {
  const email = normalizeEmail(pendingRegistration.providerEmail || user.email);
  const firstName = normalizeRequiredText(user.firstName || pendingRegistration.givenName, 'nombre');
  const lastName = normalizeRequiredText(user.lastName || pendingRegistration.familyName, 'apellido');
  const birthDate = normalizeBirthDate(user.birthDate || user.dateOfBirth);
  const gender = normalizeGender(user.gender);
  const phone = normalizePhone(user.phone);
  const providerEmail = normalizeEmail(pendingRegistration.providerEmail);
  const emailVerified = Boolean(
    providerEmail &&
      pendingRegistration.emailVerified &&
      email === providerEmail,
  );

  if (!isValidEmail(email)) {
    throw createHttpError(422, 'Ingresa un correo valido.', 'invalid_email');
  }

  return {
    birthDate,
    email,
    emailVerified,
    firstName,
    gender,
    lastName,
    phone,
  };
}

function normalizeRequiredText(value, fieldName) {
  const text = String(value || '').trim();

  if (!text) {
    throw createHttpError(422, `Ingresa tu ${fieldName}.`, `missing_${fieldName}`);
  }

  if (text.length > 120) {
    throw createHttpError(422, `El campo ${fieldName} es demasiado largo.`, `invalid_${fieldName}`);
  }

  return text;
}

function normalizeBirthDate(value) {
  const birthDate = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw createHttpError(422, 'Usa el formato de fecha AAAA-MM-DD.', 'invalid_birth_date');
  }

  const [year, month, day] = birthDate.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day ||
    parsedDate >= new Date()
  ) {
    throw createHttpError(422, 'Ingresa una fecha de nacimiento valida.', 'invalid_birth_date');
  }

  return birthDate;
}

function normalizeGender(value) {
  const gender = String(value || '').trim();

  if (!GENDERS.has(gender)) {
    throw createHttpError(422, 'Selecciona un genero valido.', 'invalid_gender');
  }

  return gender;
}

function normalizePhone(value) {
  const phone = String(value || '').trim();
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 8 || digits.length > 15) {
    throw createHttpError(422, 'Ingresa un telefono valido.', 'invalid_phone');
  }

  return phone;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function buildProfileFromPendingRegistration(pendingRegistration, user) {
  const givenName = pendingRegistration.givenName || user.firstName;
  const familyName = pendingRegistration.familyName || user.lastName;

  return {
    email: pendingRegistration.providerEmail || user.email,
    emailVerified: user.emailVerified,
    familyName,
    givenName,
    isPrivateEmail: pendingRegistration.isPrivateEmail,
    name: pendingRegistration.providerName || buildFullName({ givenName, familyName }),
    photo: pendingRegistration.profilePicture,
    provider: pendingRegistration.provider,
    providerUserId: pendingRegistration.externalProviderId,
  };
}

function canUseEmailForAccountMatch(profile) {
  if (!profile.email) {
    return false;
  }

  if (profile.provider === 'google' || profile.provider === 'apple') {
    return profile.emailVerified;
  }

  if (profile.provider === 'facebook') {
    return true;
  }

  return false;
}

function mergeProviderProfile(providerProfile, clientProfile = {}) {
  const nameParts = splitName(clientProfile.name || providerProfile.name);

  return {
    email: normalizeEmail(providerProfile.email),
    emailVerified: Boolean(providerProfile.emailVerified),
    familyName: providerProfile.familyName || clientProfile.familyName || nameParts.lastName,
    givenName: providerProfile.givenName || clientProfile.givenName || nameParts.firstName,
    isPrivateEmail: Boolean(providerProfile.isPrivateEmail),
    name: providerProfile.name || clientProfile.name || buildFullName({
      familyName: providerProfile.familyName || clientProfile.familyName || nameParts.lastName,
      givenName: providerProfile.givenName || clientProfile.givenName || nameParts.firstName,
    }),
    photo: providerProfile.photo || clientProfile.photo || null,
    provider: providerProfile.provider,
    providerUserId: providerProfile.providerUserId,
  };
}

function mergePendingProviderProfile(profile, pendingRegistration) {
  if (!pendingRegistration) {
    return profile;
  }

  return {
    ...profile,
    email: profile.email || pendingRegistration.providerEmail,
    emailVerified: profile.emailVerified || pendingRegistration.emailVerified,
    familyName: profile.familyName || pendingRegistration.familyName,
    givenName: profile.givenName || pendingRegistration.givenName,
    isPrivateEmail: profile.isPrivateEmail || pendingRegistration.isPrivateEmail,
    name: profile.name || pendingRegistration.providerName,
    photo: profile.photo || pendingRegistration.profilePicture,
  };
}

function buildFullName({ givenName, familyName }) {
  return [givenName, familyName].filter(Boolean).join(' ') || null;
}

function ensureActiveUser(user) {
  if (!user.active) {
    throw createHttpError(403, 'La cuenta esta desactivada.', 'inactive_user');
  }
}

function buildLoggedInResponse(action, user, providers = []) {
  return {
    action,
    status: 'success',
    token: signAuthToken(user),
    user: toPublicUser(user, providers),
  };
}

async function persistAndBuildRegistrationPendingResponse(providerTypeId, profile) {
  const registrationToken = signSocialRegistrationToken({
    profile: toPublicProfile(profile),
    provider: profile.provider,
    providerUserId: profile.providerUserId,
  });
  const expiresAt = getJwtExpirationDate(registrationToken) || new Date(Date.now() + 30 * 60 * 1000);

  await PendingSocialRegistration.upsertPending(
    providerTypeId,
    profile,
    registrationToken,
    expiresAt,
  );

  return buildRegistrationPendingResponse(profile, registrationToken);
}

function buildRegistrationPendingResponse(profile, registrationToken) {
  return {
    action: 'registration_required',
    profile: toPublicProfile(profile),
    provider: profile.provider,
    registrationToken,
    requiresRegistration: true,
    status: 'requires_registration',
  };
}

function toPublicUser(user, providers = []) {
  return {
    active: user.active,
    birthDate: user.birthDate,
    email: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedDate: user.emailVerifiedDate,
    firstName: user.firstName,
    gender: user.gender,
    id: String(user.id),
    lastName: user.lastName,
    phone: user.phone,
    providers,
  };
}

function toPublicProfile(profile) {
  return {
    email: profile.email,
    emailVerified: profile.emailVerified,
    familyName: profile.familyName,
    givenName: profile.givenName,
    isPrivateEmail: profile.isPrivateEmail,
    name: profile.name,
    photo: profile.photo,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
  };
}

module.exports = {
  authenticateSocialUser,
  completeSocialRegistration,
};
