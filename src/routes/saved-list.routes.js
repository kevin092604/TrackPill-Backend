const express = require('express');

const savedListController = require('../controllers/saved-medicine-list.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/auto-generate', savedListController.generateOwnList);
router.get('/patient/:patientId/auto-generate', savedListController.generatePatientList);

router.get('/', savedListController.getLists);
router.post('/', savedListController.createList);
router.get('/:id', savedListController.getList);
router.put('/:id', savedListController.updateList);
router.delete('/:id', savedListController.deleteList);

module.exports = router;
