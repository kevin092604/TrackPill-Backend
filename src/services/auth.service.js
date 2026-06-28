const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const EmailCredential = require('../models/email-credential.model');
const Session = require('../models/session.model');
const PendingSocialRegistration = require('../models/pending-social-registration.model');
const ProviderType = require('../models/provider-type.model');
const SocialProvider = require('../models/social-provider.model');
const User = require('../models/user.model');
const VerificationCode = require('../models/verification-code.model');
const emailService = require('./email.service');
const socialProviderService = require('./social-provider.service');
const { validateRegistrationData } = require('../utils/validator');
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
const EMAIL_VERIFICATION_TYPE = 'email_verification';
const EMAIL_VERIFICATION_EXPIRATION_MINUTES = 10;

/**
 * Registra un nuevo usuario con correo y contraseña.
 * @author Jesús Zepeda,agblandin@unah.hn
 * @version 0.1.0
 * @date 2026/06/21
 * @since 2026/06/21
 */
async function registerWithEmailAndPassword(payload) {
  const validData = validateRegistrationData(payload);
  const { email, password, firstName, lastName, birthDate, gender, phone } = validData;

  const existingUserByEmail = await User.findByEmail(email);
  if (existingUserByEmail) {
    throw createHttpError(409, 'El correo ingresado ya esta registrado. Inicia sesion.', 'email_already_registered');
  }

  const existingUserByPhone = await User.findByPhone(phone);
  if (existingUserByPhone) {
    throw createHttpError(409, 'El numero de telefono ya esta registrado en otra cuenta.', 'phone_already_registered');
  }

  const saltRounds = 10;
  const hashPassword = await bcrypt.hash(password, saltRounds);
  const verificationCode = generateVerificationCode();
  const hashVerificationCode = await bcrypt.hash(verificationCode, saltRounds);
  const expirationDate = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION_MINUTES * 60 * 1000);

  const result = await db.transaction(async (client) => {
    const user = await User.create(
      {
        birthDate,
        email,
        emailVerified: false,
        firstName,
        gender,
        lastName,
        phone,
      },
      client,
    );

    await EmailCredential.create({
      hashPassword,
      userId: user.id,
    }, client);

    await VerificationCode.markUnusedAsUsed(user.id, EMAIL_VERIFICATION_TYPE, client);
    await VerificationCode.create({
      expirationDate,
      hashCode: hashVerificationCode,
      type: EMAIL_VERIFICATION_TYPE,
      userId: user.id,
    }, client);

    return {
      action: 'email_verification_required',
      codeExpiresInMinutes: EMAIL_VERIFICATION_EXPIRATION_MINUTES,
      status: 'pending_email_verification',
      user: toPublicUser(user, []),
    };
  });

  await emailService.sendEmailVerificationCode(email, verificationCode);

  return result;
}

async function verifyEmail(payload) {
  const email = normalizeEmail(payload?.email);
  const code = normalizeVerificationCode(payload?.code || payload?.verificationCode);

  if (!email) {
    throw createHttpError(400, 'El correo electronico es requerido.', 'missing_email');
  }

  if (!code) {
    throw createHttpError(400, 'El codigo de verificacion es requerido.', 'missing_verification_code');
  }

  const user = await User.findByEmail(email);

  if (!user) {
    throw createHttpError(404, 'Usuario no encontrado.', 'user_not_found');
  }

  if (user.emailVerified) {
    throw createHttpError(409, 'El correo ya fue verificado.', 'email_already_verified');
  }

  ensureActiveUser(user);

  const verificationCode = await VerificationCode.findLatestByUserAndType(
    user.id,
    EMAIL_VERIFICATION_TYPE,
  );

  if (!verificationCode) {
    throw createHttpError(404, 'No hay codigo de verificacion activo para este usuario.', 'verification_code_not_found');
  }

  if (verificationCode.used) {
    throw createHttpError(409, 'El codigo de verificacion ya fue utilizado.', 'verification_code_used');
  }

  if (new Date(verificationCode.expirationDate) <= new Date()) {
    throw createHttpError(410, 'El codigo de verificacion expiro.', 'verification_code_expired');
  }

  const isCodeValid = await bcrypt.compare(code, verificationCode.hashCode);

  if (!isCodeValid) {
    throw createHttpError(401, 'Codigo de verificacion incorrecto.', 'invalid_verification_code');
  }

  return db.transaction(async (client) => {
    const usedCode = await VerificationCode.markUsed(verificationCode.id, client);

    if (!usedCode) {
      throw createHttpError(409, 'El codigo de verificacion ya fue utilizado.', 'verification_code_used');
    }

    const verifiedUser = await User.markEmailVerified(user.id, client);

    await EmailCredential.markVerified(user.id, client);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const session = await Session.create(
      {
        active: true,
        ipAddress: payload.ipAddress || null,
        refreshToken,
        userAgent: payload.userAgent || null,
        userId: user.id,
      },
      client,
    );
    const accessToken = signAuthToken(verifiedUser, session.id);

    return {
      action: 'email_verified',
      refreshToken,
      status: 'success',
      token: accessToken,
      user: toPublicUser(verifiedUser, []),
    };
  });
}

/**
 * Función que permite iniciar sesión a un usuario con su correo y contraseña.
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/06/20
 * @date 2026/06/21
 * @param {Object} payload - Objeto con el correo y la contraseña del usuario.
 * @param {string} payload.email - Correo electrónico del usuario.
 * @param {string} payload.password - Contraseña del usuario.
 * @param {string} payload.ipAddress - Dirección IP del usuario.
 * @param {string} payload.userAgent - Agente de usuario del usuario.
 * @returns {Promise<Object>} - Objeto con el token de acceso, el token de refresco y la información del usuario.
 */
async function resendEmailVerification(payload) {
  const email = normalizeEmail(payload?.email);

  if (!email) {
    throw createHttpError(400, 'El correo electronico es requerido.', 'missing_email');
  }

  const user = await User.findByEmail(email);

  if (!user) {
    throw createHttpError(404, 'Usuario no encontrado.', 'user_not_found');
  }

  ensureActiveUser(user);

  if (user.emailVerified) {
    throw createHttpError(409, 'El correo ya fue verificado.', 'email_already_verified');
  }

  const saltRounds = 10;
  const verificationCode = generateVerificationCode();
  const hashVerificationCode = await bcrypt.hash(verificationCode, saltRounds);
  const expirationDate = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION_MINUTES * 60 * 1000);

  const result = await db.transaction(async (client) => {
    await VerificationCode.markUnusedAsUsed(user.id, EMAIL_VERIFICATION_TYPE, client);
    await VerificationCode.create({
      expirationDate,
      hashCode: hashVerificationCode,
      type: EMAIL_VERIFICATION_TYPE,
      userId: user.id,
    }, client);

    return {
      action: 'email_verification_code_resent',
      codeExpiresInMinutes: EMAIL_VERIFICATION_EXPIRATION_MINUTES,
      status: 'pending_email_verification',
    };
  });

  await emailService.sendEmailVerificationCode(email, verificationCode);

  return result;
}

async function authenticateWithEmailAndPassword(payload) {

  const email = normalizeEmail(payload?.email);
  const password = payload?.password;

  if (!email) {
    throw createHttpError(400, "El correo electrónico es requerido", "missing_email");
  }

  if (!password) {
    throw createHttpError(400, "La contraseña es requerida", "missing_password");
  }

  const user = await User.findByEmail(email);

  if (!user) {
    throw createHttpError(401, "Correo o contraseña incorrectos", "invalid_credentials");
  }

  ensureActiveUser(user);

  const credential = await EmailCredential.findByUserId(user.id);

  if (!credential || !credential.hashPassword) {
    throw createHttpError(401, "Correo o contraseña incorrectos", "invalid_credentials");
  }

  if (!credential.verified || !user.emailVerified) {
    throw createHttpError(403, 'Verifica tu correo antes de iniciar sesion.', 'email_not_verified');
  }

  const isMatch = await bcrypt.compare(password, credential.hashPassword);

  if (!isMatch) {
    throw createHttpError(401, "Correo o contraseña incorrectos", "invalid_credentials");
  }

  const refreshToken = crypto.randomBytes(40).toString('hex');
  
  const session = await Session.create(
    {
      userId: user.id,
      refreshToken,
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
      active: true
    }
  );
  
  const accessToken = signAuthToken(user, session.id);

  const providers = await SocialProvider.findProviderNamesByUserId(user.id);

  return {
    action: 'login_redirect',
    status: 'success',
    token: accessToken,
    refreshToken,
    user: toPublicUser(user, providers)
  };
}

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

function buildAppleCallbackRedirectUrl(payload = {}) {
  const state = parseAppleCallbackState(payload.state);
  const appRedirectUri = state.appRedirectUri;

  if (!isAllowedAppleAppRedirectUri(appRedirectUri)) {
    throw createHttpError(
      400,
      'Redirect URI de Apple no permitida.',
      'invalid_apple_app_redirect_uri',
    );
  }

  const redirectUrl = new URL(appRedirectUri);

  if (payload.error) {
    redirectUrl.searchParams.set('error', payload.error);
    setOptionalSearchParam(redirectUrl, 'errorDescription', payload.error_description);
    setOptionalSearchParam(redirectUrl, 'state', payload.state);
    return redirectUrl.toString();
  }

  if (!payload.id_token) {
    throw createHttpError(
      400,
      'Apple no devolvio identity token.',
      'missing_apple_identity_token',
    );
  }

  redirectUrl.searchParams.set('identityToken', payload.id_token);
  setOptionalSearchParam(redirectUrl, 'authorizationCode', payload.code);
  setOptionalSearchParam(redirectUrl, 'state', payload.state);
  setOptionalSearchParam(redirectUrl, 'user', payload.user);

  return redirectUrl.toString();
}

function parseAppleCallbackState(rawState) {
  if (!rawState) {
    throw createHttpError(400, 'State de Apple requerido.', 'missing_apple_state');
  }

  try {
    const state = JSON.parse(rawState);

    if (!state?.appRedirectUri || state.provider !== 'apple') {
      throw new Error('Invalid Apple state');
    }

    return state;
  } catch (_error) {
    throw createHttpError(400, 'State de Apple invalido.', 'invalid_apple_state');
  }
}

function isAllowedAppleAppRedirectUri(appRedirectUri) {
  try {
    const url = new URL(appRedirectUri);
    const scheme = url.protocol.replace(':', '').toLowerCase();
    const allowedSchemes = (process.env.APPLE_CALLBACK_ALLOWED_SCHEMES || 'trackpill')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const allowedOrigins = (process.env.APPLE_CALLBACK_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowedSchemes.includes(scheme)) {
      return true;
    }

    return ['http', 'https'].includes(scheme) && allowedOrigins.includes(url.origin.toLowerCase());
  } catch (_error) {
    return false;
  }
}

function setOptionalSearchParam(url, key, value) {
  if (value) {
    url.searchParams.set(key, value);
  }
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

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function normalizeVerificationCode(code) {
  const value = String(code || '').replace(/\D/g, '');

  return /^\d{6}$/.test(value) ? value : null;
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
  authenticateWithEmailAndPassword,
  buildAppleCallbackRedirectUrl,
  completeSocialRegistration,
  registerWithEmailAndPassword,
  resendEmailVerification,
  verifyEmail,
};
