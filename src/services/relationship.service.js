const crypto = require('crypto');

const db = require('../config/db');
const CaregiverRelationship = require('../models/caregiver-relationship.model');
const InvitationToken = require('../models/invitation-token.model');
const User = require('../models/user.model');
const { createHttpError, normalizeEmail } = require('../utils/helpers');
const emailService = require('./email.service');

const INITIATOR_ROLES = new Set(['caregiver', 'patient']);
const RESPONSE_STATUSES = new Set(['aceptada', 'rechazada']);

async function requestRelationship(payload, currentUser) {
  const initiatedBy = normalizeInitiatorRole(payload?.initiatedAs || payload?.initiatedBy);
  const targetUser = await findTargetUser(payload);

  ensureAvailableUser(targetUser, 'target_user_not_found');
  ensureDifferentUsers(currentUser.id, targetUser.id);

  const participants = buildParticipants(currentUser.id, targetUser.id, initiatedBy);

  return createPendingRelationship({
    ...participants,
    initiatedBy,
    invitationChannel: 'busqueda',
    relationshipLabel: normalizeRelationshipLabel(payload?.relationshipLabel),
  });
}

async function createInvitationToken(payload, currentUser) {
  const initiatedAs = normalizeInitiatorRole(payload?.initiatedAs || payload?.initiatedBy);
  const invitationChannel = normalizeTokenChannel(payload?.invitationChannel);
  const expirationMinutes = getInvitationExpirationMinutes();
  const token = `${invitationChannel}.${crypto.randomBytes(32).toString('base64url')}`;
  const invitationToken = await InvitationToken.create({
    expirationDate: new Date(Date.now() + expirationMinutes * 60 * 1000),
    initiatedAs,
    initiatorId: currentUser.id,
    token,
  });

  return { action: 'invitation_token_created', invitationChannel, invitationToken, status: 'success' };
}

async function redeemInvitationToken(payload, currentUser) {
  const token = normalizeToken(payload?.token);
  const invitationChannel = getChannelFromToken(token, payload?.invitationChannel);

  return db.transaction(async (client) => {
    const invitation = await InvitationToken.findByToken(token, client, { forUpdate: true });
    if (!invitation) throw createHttpError(404, 'Token de invitacion no encontrado.', 'invitation_token_not_found');
    if (invitation.used) throw createHttpError(409, 'El token de invitacion ya fue utilizado.', 'invitation_token_used');
    if (new Date(invitation.expirationDate) <= new Date()) throw createHttpError(410, 'El token de invitacion expiro.', 'invitation_token_expired');

    ensureDifferentUsers(invitation.initiatorId, currentUser.id);
    ensureAvailableUser(await User.findById(invitation.initiatorId, client), 'invitation_initiator_not_found');
    const participants = buildParticipants(invitation.initiatorId, currentUser.id, invitation.initiatedAs);
    const relationship = await createPendingRelationship({
      ...participants,
      initiatedBy: invitation.initiatedAs,
      invitationChannel,
      relationshipLabel: normalizeRelationshipLabel(payload?.relationshipLabel),
    }, client);
    if (!await InvitationToken.markUsed(invitation.id, client)) {
      throw createHttpError(409, 'El token de invitacion ya fue utilizado.', 'invitation_token_used');
    }
    return { action: 'invitation_token_redeemed', relationship, status: 'success' };
  });
}

async function respondToRelationship(relationshipId, payload, currentUser) {
  const id = normalizeId(relationshipId, 'relationship_id');
  const responseStatus = normalizeResponseStatus(payload?.status || payload?.response);
  const relationship = await CaregiverRelationship.findById(id);
  if (!relationship) throw createHttpError(404, 'Solicitud de relacion no encontrada.', 'relationship_not_found');
  if (relationship.status !== 'pendiente') throw createHttpError(409, 'La solicitud de relacion ya fue respondida.', 'relationship_already_responded');

  const initiatorId = relationship.initiatedBy === 'caregiver' ? relationship.caregiverId : relationship.patientId;
  const responderId = relationship.initiatedBy === 'caregiver' ? relationship.patientId : relationship.caregiverId;
  if (String(currentUser.id) !== String(responderId)) throw createHttpError(403, 'Solo el destinatario puede responder esta solicitud.', 'relationship_response_forbidden');

  const updatedRelationship = await CaregiverRelationship.updateResponse(id, responseStatus);
  if (!updatedRelationship) throw createHttpError(409, 'La solicitud de relacion ya fue respondida.', 'relationship_already_responded');

  const initiator = await User.findById(initiatorId);
  let notification = null;
  if (initiator?.email) {
    notification = await emailService.sendRelationshipResponseNotification({
      email: initiator.email,
      responderName: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' '),
      status: responseStatus,
    });
  }
  return {
    action: 'relationship_request_responded',
    notification: { channel: initiator?.email ? 'email' : null, delivered: Boolean(notification) },
    relationship: updatedRelationship,
    status: 'success',
  };
}

async function createPendingRelationship(relationship, client = db) {
  const existingRelationship = await CaregiverRelationship.findOpenBetween(
    relationship.caregiverId,
    relationship.patientId,
    client,
  );

  if (existingRelationship) {
    throwDuplicateRelationship(existingRelationship);
  }

  try {
    return await CaregiverRelationship.create(relationship, client);
  } catch (error) {
    if (error?.code === '23505') {
      throw createHttpError(
        409,
        'Ya existe una relacion pendiente o aceptada entre estos usuarios.',
        'relationship_already_exists',
      );
    }

    throw error;
  }
}

async function findTargetUser(payload) {
  if (payload?.targetUserId || payload?.userId) {
    return User.findById(normalizeId(payload.targetUserId || payload.userId, 'target_user_id'));
  }

  const email = normalizeEmail(payload?.targetEmail || payload?.email);

  if (email) {
    return User.findByEmail(email);
  }

  const phone = normalizePhone(payload?.targetPhone || payload?.phone);
  if (phone) {
    return User.findByPhone(phone);
  }

  const query = String(payload?.targetQuery || payload?.query || '').trim();
  if (query) {
    if (query.includes('@')) return User.findByEmail(normalizeEmail(query));
    if (/^\+?[\d\s()-]{7,20}$/.test(query)) return User.findByPhone(normalizePhone(query));
    if (/^\d+$/.test(query)) return User.findById(normalizeId(query, 'target_user_id'));
    throw createHttpError(422, 'Busca por correo, telefono o ID de usuario.', 'invalid_relationship_target');
  }

  throw createHttpError(
    400,
    'Indica ID, correo o telefono.',
    'missing_relationship_target',
  );
}

function normalizePhone(value) {
  if (!value) return null;
  const phone = String(value).trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) throw createHttpError(422, 'Telefono invalido.', 'invalid_target_phone');
  return phone;
}

function buildParticipants(initiatorId, recipientId, initiatedBy) {
  return initiatedBy === 'caregiver'
    ? { caregiverId: initiatorId, patientId: recipientId }
    : { caregiverId: recipientId, patientId: initiatorId };
}

function ensureAvailableUser(user, errorCode) {
  if (!user || !user.active) {
    throw createHttpError(404, 'Usuario no encontrado o inactivo.', errorCode);
  }
}

function ensureDifferentUsers(firstUserId, secondUserId) {
  if (String(firstUserId) === String(secondUserId)) {
    throw createHttpError(
      422,
      'No puedes crear una relacion contigo mismo.',
      'relationship_with_self',
    );
  }
}

function normalizeId(value, fieldName) {
  const id = String(value || '').trim();

  if (!/^\d+$/.test(id) || id === '0') {
    throw createHttpError(400, `${fieldName} invalido.`, `invalid_${fieldName}`);
  }

  return id;
}

function normalizeInitiatorRole(value) {
  const role = String(value || '').trim().toLowerCase();

  if (!INITIATOR_ROLES.has(role)) {
    throw createHttpError(
      422,
      'initiatedAs debe ser caregiver o patient.',
      'invalid_relationship_role',
    );
  }

  return role;
}

function normalizeRelationshipLabel(value) {
  const label = String(value || '').trim();

  if (label.length > 120) {
    throw createHttpError(
      422,
      'relationshipLabel no puede superar 120 caracteres.',
      'invalid_relationship_label',
    );
  }

  return label || null;
}

function normalizeToken(value) {
  const token = String(value || '').trim();
  if (!token || token.length > 200) throw createHttpError(400, 'Token de invitacion invalido.', 'invalid_invitation_token');
  return token;
}

function normalizeResponseStatus(value) {
  const aliases = { accepted: 'aceptada', rejected: 'rechazada' };
  const normalized = String(value || '').trim().toLowerCase();
  const status = aliases[normalized] || normalized;
  if (!RESPONSE_STATUSES.has(status)) throw createHttpError(422, 'La respuesta debe ser aceptada o rechazada.', 'invalid_relationship_response');
  return status;
}

function normalizeTokenChannel(value) {
  const channel = String(value || 'qr').trim().toLowerCase();
  if (!['qr', 'enlace'].includes(channel)) throw createHttpError(422, 'invitationChannel debe ser qr o enlace.', 'invalid_invitation_channel');
  return channel;
}

function getChannelFromToken(token, fallbackChannel) {
  return normalizeTokenChannel(token.includes('.') ? token.split('.', 1)[0] : fallbackChannel);
}

function getInvitationExpirationMinutes() {
  const value = Number(process.env.RELATIONSHIP_INVITATION_EXPIRES_IN_MINUTES || 15);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 10080) : 15;
}

function throwDuplicateRelationship(relationship) {
  throw createHttpError(
    409,
    'Ya existe una relacion pendiente o aceptada entre estos usuarios.',
    'relationship_already_exists',
    {
      relationshipId: String(relationship.id),
      status: relationship.status,
    },
  );
}

module.exports = {
  createInvitationToken,
  redeemInvitationToken,
  requestRelationship,
  respondToRelationship,
};
