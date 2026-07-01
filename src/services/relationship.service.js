const db = require('../config/db');
const CaregiverRelationship = require('../models/caregiver-relationship.model');
const User = require('../models/user.model');
const { createHttpError, normalizeEmail } = require('../utils/helpers');

const INITIATOR_ROLES = new Set(['caregiver', 'patient']);

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

  throw createHttpError(
    400,
    'Indica targetUserId o targetEmail para buscar al usuario.',
    'missing_relationship_target',
  );
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
  requestRelationship,
};
