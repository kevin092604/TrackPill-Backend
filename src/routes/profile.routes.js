const express = require('express');
const multer = require('multer');

const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = express.Router();

router.use(authMiddleware);
router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.post('/photo', upload.single('photo'), profileController.uploadPhoto);

module.exports = router;
