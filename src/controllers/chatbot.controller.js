const chatbotService = require('../services/chatbot.service');

/**
 * Controlador que envía un mensaje del usuario a Tuchi IA y retorna la respuesta generada.
 */
async function sendMessage(req, res, next) {
  try {
    const { conversationId, message } = req.body;
    const result = await chatbotService.sendMessage(req.user.id, conversationId, message);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador que retorna las conversaciones del usuario autenticado con Tuchi IA.
 */
async function getConversations(req, res, next) {
  try {
    const conversations = await chatbotService.getConversations(req.user.id);

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlador que retorna los mensajes de una conversación específica.
 */
async function getMessages(req, res, next) {
  try {
    const messages = await chatbotService.getMessages(req.user.id, req.params.id);

    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendMessage,
  getConversations,
  getMessages,
};
