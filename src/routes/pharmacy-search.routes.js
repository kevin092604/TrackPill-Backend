const express = require('express');

const pharmacySearchController = require('../controllers/pharmacy-search.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', pharmacySearchController.listNearby);
router.get('/search', pharmacySearchController.search);
router.post('/compare', pharmacySearchController.compare);

module.exports = router;
