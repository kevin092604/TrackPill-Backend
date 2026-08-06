const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const conversationModel = require('../models/chat-conversation.model');
const messageModel = require('../models/chat-message.model');
const dashboardService = require('./dashboard.service');
const medicineService = require('./medicine.service');
const { createHttpError, getRequiredEnv } = require('../utils/helpers');

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const MAX_TOKENS = Number(process.env.CHATBOT_MAX_TOKENS) || 1024;
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `Eres Tuchi, el asistente virtual de TrackPill, una aplicación de administración de medicamentos.
- Responde siempre en español, de forma breve, cálida y clara.
- Usa las herramientas disponibles para consultar datos reales del usuario antes de responder preguntas sobre sus medicamentos, dosis o adherencia; nunca inventes esa información.
- No das diagnósticos médicos ni indicaciones de tratamiento. Ante síntomas o decisiones médicas, recomienda consultar a un profesional de la salud.
- Si te preguntan cómo usar una función de la app, explica los pasos de forma breve.`;

const TOOLS = [
  {
    toolSpec: {
      name: 'get_dashboard_summary',
      description: 'Obtiene el resumen de dosis de hoy, adherencia semanal y la próxima dosis pendiente del paciente autenticado.',
      inputSchema: { json: { type: 'object', properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: 'get_medications',
      description: 'Obtiene la lista de medicamentos activos del paciente autenticado, con dosis, frecuencia, stock y próxima toma. Admite un término de búsqueda opcional.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Texto para filtrar medicamentos por nombre (opcional).' },
          },
          required: [],
        },
      },
    },
  },
];

let bedrockClient = null;

function getClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_AWS_REGION || getRequiredEnv('AWS_REGION'),
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
    return await getClient().send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages,
      toolConfig: { tools: TOOLS },
      inferenceConfig: { maxTokens: MAX_TOKENS },
    }));
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
 * Envía un mensaje del usuario a Tuchi IA (Claude vía Amazon Bedrock, API Converse), resolviendo
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
  const messages = history.map((entry) => ({
    role: entry.role,
    content: [{ text: entry.content }],
  }));

  let finalText = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await callBedrock(messages);
    const outputMessage = response.output.message;

    if (response.stopReason !== 'tool_use') {
      finalText = outputMessage.content
        .filter((block) => block.text)
        .map((block) => block.text)
        .join('\n')
        .trim();
      break;
    }

    messages.push(outputMessage);

    const toolResultContent = [];

    for (const block of outputMessage.content) {
      if (!block.toolUse) {
        continue;
      }

      let result;

      try {
        result = await runTool(block.toolUse.name, block.toolUse.input, userId);
      } catch (toolError) {
        result = { error: toolError.message || 'Error ejecutando la herramienta.' };
      }

      toolResultContent.push({
        toolResult: {
          toolUseId: block.toolUse.toolUseId,
          content: [{ text: JSON.stringify(result) }],
        },
      });
    }

    messages.push({ role: 'user', content: toolResultContent });
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
