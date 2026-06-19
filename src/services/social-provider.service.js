const { OAuth2Client } = require('google-auth-library');

const {
  createHttpError,
  getRequiredEnv,
  normalizeEmail,
} = require('../utils/helpers');

const PROVIDERS = {
  APPLE: 'apple',
  FACEBOOK: 'facebook',
  GOOGLE: 'google',
};

let googleClient;
let appleJwks;
let facebookJwks;
let joseModulePromise;

function normalizeProvider(provider) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();

  return Object.values(PROVIDERS).includes(normalizedProvider)
    ? normalizedProvider
    : null;
}

async function verifyProviderCredential(provider, credential) {
  if (provider === PROVIDERS.GOOGLE) {
    return verifyGoogleCredential(credential);
  }

  if (provider === PROVIDERS.APPLE) {
    return verifyAppleCredential(credential);
  }

  if (provider === PROVIDERS.FACEBOOK) {
    return verifyFacebookCredential(credential);
  }

  throw createHttpError(400, 'Proveedor social no soportado.', 'unsupported_social_provider');
}

async function verifyGoogleCredential(credential) {
  const idToken = credential.idToken;

  if (!idToken) {
    throw createHttpError(400, 'Google requiere idToken.', 'missing_google_id_token');
  }

  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    audience: getGoogleAudiences(),
    idToken,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub) {
    throw createHttpError(401, 'Token de Google invalido.', 'invalid_google_token');
  }

  return {
    email: normalizeEmail(payload.email),
    emailVerified: payload.email_verified === true,
    familyName: payload.family_name || null,
    givenName: payload.given_name || null,
    name: payload.name || null,
    photo: payload.picture || null,
    provider: PROVIDERS.GOOGLE,
    providerUserId: payload.sub,
    raw: payload,
  };
}

async function verifyAppleCredential(credential) {
  const identityToken = credential.identityToken;

  if (!identityToken) {
    throw createHttpError(400, 'Apple requiere identityToken.', 'missing_apple_identity_token');
  }

  const audiences = getAppleAudiences();
  const { jwtVerify } = await getJose();
  const { payload } = await jwtVerify(identityToken, await getAppleJwks(), {
    audience: audiences,
    issuer: process.env.APPLE_ISSUER || 'https://appleid.apple.com',
  });

  if (!payload?.sub) {
    throw createHttpError(401, 'Token de Apple invalido.', 'invalid_apple_token');
  }

  return {
    email: normalizeEmail(payload.email),
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    familyName: null,
    givenName: null,
    isPrivateEmail: payload.is_private_email === true || payload.is_private_email === 'true',
    name: null,
    photo: null,
    provider: PROVIDERS.APPLE,
    providerUserId: payload.sub,
    raw: payload,
  };
}

async function verifyFacebookCredential(credential) {
  if (credential.accessToken) {
    return verifyFacebookAccessToken(credential.accessToken);
  }

  if (credential.authenticationToken) {
    return verifyFacebookAuthenticationToken(credential.authenticationToken);
  }

  throw createHttpError(
    400,
    'Facebook requiere accessToken o authenticationToken.',
    'missing_facebook_token',
  );
}

async function verifyFacebookAccessToken(accessToken) {
  const appId = getRequiredEnv('FACEBOOK_APP_ID');
  const appSecret = getRequiredEnv('FACEBOOK_APP_SECRET');
  const appAccessToken = `${appId}|${appSecret}`;
  const debugUrl = new URL('https://graph.facebook.com/debug_token');

  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', appAccessToken);

  const debugResponse = await fetchJson(debugUrl);
  const debugData = debugResponse?.data;

  if (!debugData?.is_valid || debugData.app_id !== appId) {
    throw createHttpError(401, 'Token de Facebook invalido.', 'invalid_facebook_token');
  }

  const profileUrl = new URL('https://graph.facebook.com/me');
  profileUrl.searchParams.set('fields', 'id,email,first_name,last_name,name,picture');
  profileUrl.searchParams.set('access_token', accessToken);

  const profile = await fetchJson(profileUrl);

  if (!profile?.id || profile.id !== debugData.user_id) {
    throw createHttpError(401, 'Perfil de Facebook invalido.', 'invalid_facebook_profile');
  }

  return {
    email: normalizeEmail(profile.email),
    emailVerified: Boolean(profile.email),
    familyName: profile.last_name || null,
    givenName: profile.first_name || null,
    name: profile.name || null,
    photo: profile.picture?.data?.url || null,
    provider: PROVIDERS.FACEBOOK,
    providerUserId: profile.id,
    raw: profile,
  };
}

async function verifyFacebookAuthenticationToken(authenticationToken) {
  const appId = getRequiredEnv('FACEBOOK_APP_ID');
  const { jwtVerify } = await getJose();
  const { payload } = await jwtVerify(authenticationToken, await getFacebookJwks(), {
    audience: appId,
    issuer: process.env.FACEBOOK_ISSUER || 'https://www.facebook.com',
  });

  if (!payload?.sub) {
    throw createHttpError(401, 'Token de Facebook invalido.', 'invalid_facebook_token');
  }

  return {
    email: normalizeEmail(payload.email),
    emailVerified: Boolean(payload.email),
    familyName: payload.family_name || null,
    givenName: payload.given_name || null,
    name: payload.name || null,
    photo: payload.picture || null,
    provider: PROVIDERS.FACEBOOK,
    providerUserId: payload.sub,
    raw: payload,
  };
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new OAuth2Client();
  }

  return googleClient;
}

function getGoogleAudiences() {
  const audiences = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean);

  if (!audiences.length) {
    throw createHttpError(
      500,
      'Configura al menos un client ID de Google.',
      'missing_google_client_id',
    );
  }

  return audiences;
}

function getAppleAudiences() {
  const audiences = [
    process.env.APPLE_BUNDLE_ID,
    process.env.APPLE_SERVICE_ID,
  ].filter(Boolean);

  if (!audiences.length) {
    throw createHttpError(
      500,
      'Configura APPLE_BUNDLE_ID o APPLE_SERVICE_ID.',
      'missing_apple_audience',
    );
  }

  return audiences;
}

async function getJose() {
  if (!joseModulePromise) {
    joseModulePromise = import('jose');
  }

  return joseModulePromise;
}

async function getAppleJwks() {
  const { createRemoteJWKSet } = await getJose();

  if (!appleJwks) {
    appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  }

  return appleJwks;
}

async function getFacebookJwks() {
  const { createRemoteJWKSet } = await getJose();

  if (!facebookJwks) {
    facebookJwks = createRemoteJWKSet(
      new URL('https://www.facebook.com/.well-known/oauth/openid/jwks/'),
    );
  }

  return facebookJwks;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw createHttpError(
      response.status,
      data?.error?.message || 'No fue posible verificar la credencial social.',
      'provider_verification_failed',
      data,
    );
  }

  return data;
}

module.exports = {
  normalizeProvider,
  verifyProviderCredential,
};
