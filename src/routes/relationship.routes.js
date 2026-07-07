const express = require('express');

const relationshipController = require('../controllers/relationship.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

//router.use(authMiddleware);

router.get('/', relationshipController.getRelationships);

router.post('/request', relationshipController.requestRelationship);
router.post('/invite-token', relationshipController.createInvitationToken);
router.post('/redeem-token', relationshipController.redeemInvitationToken);
router.post('/:id/respond', relationshipController.respondToRelationship);
router.patch('/:id/active', relationshipController.updateRelationshipActiveStatus);

module.exports = router;
