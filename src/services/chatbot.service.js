const { AnthropicBedrockMantle } = require('@anthropic-ai/bedrock-sdk');

const conversationModel = require('../models/chat-conversation.model');
const messageModel = require('../models/chat-message.model');
const dashboardService = require('./dashboard.service');
const medicineService = require('./medicine.service');
const { createHttpError, getRequiredEnv } = require('../utils/helpers');

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_TOKENS = Number(process.env.CHATBOT_MAX_TOKENS) || 1024;
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `Eres Tuchi, el asistente virtual de TrackPill, una aplicación de administración de medicamentos.
- Responde siempre en español, de forma breve, cálida y clara.
- Usa las herramientas disponibles para consultar datos reales del usuario antes de responder preguntas sobre sus medicamentos, dosis o adherencia; nunca inventes esa información.
- No das diagnósticos médicos ni indicaciones de tratamiento. Ante síntomas o decisiones médicas, recomienda consultar a un profesional de la salud.
- Si te preguntan cómo usar una función de la app, explica los pasos de forma breve.`;

const TOOLS = [
  {
    name: 'get_dashboard_summary',
    description: 'Obtiene el resumen de dosis de hoy, adherencia semanal y la próxima dosis pendiente del paciente autenticado.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_medications',
    description: 'Obtiene la lista de medicamentos activos del paciente autenticado, con dosis, frecuencia, stock y próxima toma. Admite un término de búsqueda opcional.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Texto para filtrar medicamentos por nombre (opcional).' },
      },
      required: [],
    },
  },
];

let bedrockClient = null;

function getClient() {
  if (!bedrockClient) {
    bedrockClient = new AnthropicBedrockMantle({
      awsRegion: process.env.BEDROCK_AWS_REGION || getRequiredEnv('AWS_REGION'),
    });
  }

  return bedrockClient;
}

async function runTool(name, input, userId) {
  switch (name) {
    case 'get_dashboard_summary':
      return dashboardService.getPatientSummary(userId);
    case 'get_medications':
      return medicineService.getMedicines(userId, input?.search || '');
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

async function callBedrock(messages) {
  try {
    return await getClient().messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
  } catch (error) {
    throw createHttpError(
      502,
      'No se pudo obtener respuesta de Tuchi IA en este momento.',
      'chatbot_provider_error',
      error.message,
    );
  }
}

/**
 * Envía un mensaje del usuario a Tuchi IA (Claude vía Amazon Bedrock), resolviendo
 * las herramientas de datos que el modelo solicite, y persiste la conversación.
 */
async function sendMessage(userId, conversationId, userMessage) {
  if (!userMessage || !userMessage.trim()) {
    throw createHttpError(400, 'El mensaje no puede estar vacío.', 'empty_message');
  }

  let conversation = conversationId
    ? await conversationModel.findByIdForUser(conversationId, userId)
    : null;

  if (!conversation) {
    conversation = await conversationModel.create(userId, userMessage.trim().slice(0, 60));
  }

  await messageModel.create(conversation.id, 'user', userMessage.trim());

  const history = await messageModel.findByConversationId(conversation.id);
  const messages = history.map((entry) => ({ role: entry.role, content: entry.content }));

  let finalText = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await callBedrock(messages);

    if (response.stop_reason !== 'tool_use') {
      finalText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') {
        continue;
      }

      let result;

      try {
        result = await runTool(block.name, block.input, userId);
      } catch (toolError) {
        result = { error: toolError.message || 'Error ejecutando la herramienta.' };
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    finalText = 'Lo siento, no pude generar una respuesta en este momento. Intenta de nuevo en unos minutos.';
  }

  const assistantMessage = await messageModel.create(conversation.id, 'assistant', finalText);
  await conversationModel.touch(conversation.id);

  return {
    conversationId: conversation.id,
    message: assistantMessage,
  };
}

async function getConversations(userId) {
  return conversationModel.findAllByUserId(userId);
}

async function getMessages(userId, conversationId) {
  const conversation = await conversationModel.findByIdForUser(conversationId, userId);

  if (!conversation) {
    throw createHttpError(404, 'Conversación no encontrada.', 'conversation_not_found');
  }

  return messageModel.findByConversationId(conversationId);
}

module.exports = {
  sendMessage,
  getConversations,
  getMessages,
};
