const express = require('express');

const pharmacySearchController = require('../controllers/pharmacy-search.controller');
const pharmacyFavoriteController = require('../controllers/pharmacy-favorite.controller');
const savedLocationController = require('../controllers/saved-location.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/favorites', pharmacyFavoriteController.list);
router.post('/favorites', pharmacyFavoriteController.add);
router.delete('/favorites/:placeId', pharmacyFavoriteController.remove);

router.get('/search-history', pharmacySearchController.getSearchHistory);
router.delete('/search-history', pharmacySearchController.clearSearchHistory);
router.delete('/search-history/:id', pharmacySearchController.removeSearchHistoryEntry);

router.get('/locations/geocode', savedLocationController.geocode);
router.get('/locations', savedLocationController.list);
router.post('/locations', savedLocationController.add);
router.delete('/locations/:id', savedLocationController.remove);

router.get('/route', pharmacySearchController.route);

router.get('/', pharmacySearchController.listNearby);
router.get('/search', pharmacySearchController.search);
router.post('/compare', pharmacySearchController.compare);

module.exports = router;
