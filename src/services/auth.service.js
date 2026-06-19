const ProviderType = require('../models/provider-type.model');
const SocialProvider = require('../models/social-provider.model');
const User = require('../models/user.model');
const socialProviderService = require('./social-provider.service');
const {
  createHttpError,
  normalizeEmail,
  signAuthToken,
  signSocialRegistrationToken,
  splitName,
} = require('../utils/helpers');

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

  const userByEmail = profile.email
    ? await User.findByEmail(normalizeEmail(profile.email))
    : null;

  if (userByEmail) {
    ensureActiveUser(userByEmail);
    await SocialProvider.createOrUpdateLink(userByEmail.id, providerType.id, profile);

    return buildLoggedInResponse(
      'linked_existing_account',
      userByEmail,
      await SocialProvider.findProviderNamesByUserId(userByEmail.id),
    );
  }

  return buildRegistrationPendingResponse(profile);
}

function mergeProviderProfile(providerProfile, clientProfile = {}) {
  const nameParts = splitName(clientProfile.name || providerProfile.name);

  return {
    email: normalizeEmail(providerProfile.email || clientProfile.email),
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

function buildRegistrationPendingResponse(profile) {
  return {
    action: 'registration_required',
    profile: toPublicProfile(profile),
    provider: profile.provider,
    registrationToken: signSocialRegistrationToken({
      profile: toPublicProfile(profile),
      provider: profile.provider,
      providerUserId: profile.providerUserId,
    }),
    requiresRegistration: true,
    status: 'requires_registration',
  };
}

function toPublicUser(user, providers = []) {
  return {
    active: user.active,
    birthDate: user.birthDate,
    email: user.email,
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
};
