const express = require('express');
const rateLimit = require('express-rate-limit');

const chatbotController = require('../controllers/chatbot.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { createHttpError } = require('../utils/helpers');

/**
 * Limita la cantidad de mensajes enviados a Tuchi IA por usuario para controlar costo y abuso.
 */
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  handler: (req, res, next) => {
    next(createHttpError(
      429,
      'Demasiados mensajes. Espera un momento antes de continuar.',
      'too_many_requests',
    ));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.use(authMiddleware);

router.post('/messages', chatbotLimiter, chatbotController.sendMessage);
router.get('/conversations', chatbotController.getConversations);
router.get('/conversations/:id/messages', chatbotController.getMessages);

module.exports = router;
