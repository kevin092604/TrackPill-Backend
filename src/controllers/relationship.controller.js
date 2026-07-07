const relationshipService = require('../services/relationship.service');
const {createHttpError} = require('../utils/helpers')

async function requestRelationship(req, res, next) {
  try {
    const relationship = await relationshipService.requestRelationship(req.body, req.user);

    res.status(201).json({
      action: 'relationship_request_created',
      relationship,
      status: 'success',
      success: true,
    });
  } catch (error) {
    next(error);
  }
}

async function createInvitationToken(req, res, next) {
  try {
    res.status(201).json({ success: true, ...await relationshipService.createInvitationToken(req.body, req.user) });
  } catch (error) { next(error); }
}

async function redeemInvitationToken(req, res, next) {
  try {
    res.status(201).json({ success: true, ...await relationshipService.redeemInvitationToken(req.body, req.user) });
  } catch (error) { next(error); }
}

async function respondToRelationship(req, res, next) {
  try {
    res.status(200).json({ success: true, ...await relationshipService.respondToRelationship(req.params.id, req.body, req.user) });
  } catch (error) { next(error); }
}

/**
 * Controlador que actualiza el estado activo de una relación entre usuarios
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/06
 * @date 2026/07/06
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
async function updateRelationshipActiveStatus(req, res, next) {
  try {
    const result = await relationshipService.updateRelationshipActiveStatus(
      req.params.id,
      req.body,
      req.user,
    );
    res.status(200).json(
      {
        success: true,
        ...result,
      }
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para obtener el listado del círculo de cuidado
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/07
 * @date 2026/07/07
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getRelationships(req, res, next) {
  try {
    const { direction } = req.query;
    const userId = req?.user?.id; 

    if (!userId) {
      throw createHttpError(401, 'Usuario no autenticado.', 'unauthorized');
    }

    const relationships = await relationshipService.getRelationshipsList(userId, direction);

    res.status(200).json({
      success: true,
      relationships,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador para eliminar una relación
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/07
 * @date 2026/07/07
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
async function deleteRelationship(req, res, next) {
  try {
    const relationshipId = req.params.id;
    const currentUser = req?.user;

    if (!currentUser || !currentUser.id) {
      throw createHttpError(401, 'Usuario no autenticado.', 'unauthorized');
    }

    const result = await relationshipService.deleteRelationship(relationshipId, currentUser);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createInvitationToken,
  redeemInvitationToken,
  requestRelationship,
  respondToRelationship,
  updateRelationshipActiveStatus,
  getRelationships,
  deleteRelationship
};
