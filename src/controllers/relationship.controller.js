const relationshipService = require('../services/relationship.service');

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

module.exports = {
  requestRelationship,
};
