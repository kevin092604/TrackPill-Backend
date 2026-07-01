const express = require('express');

const relationshipController = require('../controllers/relationship.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);
router.post('/request', relationshipController.requestRelationship);

module.exports = router;
