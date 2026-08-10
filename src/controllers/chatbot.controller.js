const chatbotService = require('../services/chatbot.service');

/**
 * Controlador que envía un mensaje del usuario a Tuchi IA y retorna la respuesta completa.
 */
async function sendMessage(req, res, next) {
  try {
    const { conversationId, message, patientId, image } = req.body;
    const result = await chatbotService.sendMessage(req.user.id, conversationId, message, patientId, image);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Controlador que envía un mensaje del usuario a Tuchi IA y transmite la
 * respuesta en vivo por Server-Sent Events a medida que el modelo la genera.
 */
async function sendMessageStream(req, res, next) {
  const { conversationId, message, patientId, image } = req.body;

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    await chatbotService.sendMessageStream(req.user.id, conversationId, message, patientId, image, {
      onMeta: (meta) => writeSseEvent(res, 'meta', meta),
      onDelta: (text) => writeSseEvent(res, 'delta', { text }),
      onDone: (result) => {
        writeSseEvent(res, 'done', result);
        res.end();
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      next(error);
      return;
    }

    writeSseEvent(res, 'error', {
      code: error.code || 'chatbot_error',
      message: error.message || 'Ocurrió un error inesperado.',
    });
    res.end();
  }
}

/**
 * Controlador que retorna las conversaciones del usuario autenticado con Tuchi IA.
 * Si se indica ?patientId=, retorna las conversaciones sobre ese paciente (cuidador).
 */
async function getConversations(req, res, next) {
  try {
    const conversations = await chatbotService.getConversations(req.user.id, req.query.patientId);

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
  sendMessageStream,
  getConversations,
  getMessages,
};
