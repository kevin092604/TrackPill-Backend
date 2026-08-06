const { BedrockRuntimeClient, ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

const conversationModel = require('../models/chat-conversation.model');
const messageModel = require('../models/chat-message.model');
const CaregiverRelationship = require('../models/caregiver-relationship.model');
const dashboardService = require('./dashboard.service');
const medicineService = require('./medicine.service');
const subscriptionService = require('./subscription.service');
const { createHttpError, getRequiredEnv } = require('../utils/helpers');

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const MAX_TOKENS = Number(process.env.CHATBOT_MAX_TOKENS) || 1024;
const MAX_TOOL_ITERATIONS = 4;
const FREE_DAILY_MESSAGE_LIMIT = Number(process.env.CHATBOT_FREE_DAILY_LIMIT) || 15;

const TOOLS = [
  {
    toolSpec: {
      name: 'get_dashboard_summary',
      description: 'Obtiene el resumen de dosis de hoy, adherencia semanal y la próxima dosis pendiente del paciente relevante para esta conversación.',
      inputSchema: { json: { type: 'object', properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: 'get_medications',
      description: 'Obtiene la lista de medicamentos activos del paciente relevante para esta conversación, con dosis, frecuencia, stock y próxima toma. Admite un término de búsqueda opcional.',
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

function buildSystemPrompt(isCaregiverContext) {
  const contextLine = isCaregiverContext
    ? 'Estás ayudando a un cuidador a consultar información sobre uno de los pacientes que tiene bajo su cuidado. Cuando uses las herramientas, obtendrás datos de ese paciente, no del cuidador.'
    : 'Estás ayudando directamente al paciente sobre su propia información.';

  return `Eres Tuchi, el asistente virtual de TrackPill, una aplicación de administración de medicamentos.
- Responde siempre en español, de forma breve, cálida y clara.
- ${contextLine}
- Usa las herramientas disponibles para consultar datos reales antes de responder preguntas sobre medicamentos, dosis o adherencia; nunca inventes esa información.
- No das diagnósticos médicos ni indicaciones de tratamiento. Ante síntomas o decisiones médicas, recomienda consultar a un profesional de la salud.
- Si te preguntan cómo usar una función de la app, explica los pasos de forma breve.`;
}

let bedrockClient = null;

function getClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_AWS_REGION || getRequiredEnv('AWS_REGION'),
    });
  }

  return bedrockClient;
}

async function runTool(name, input, effectivePatientId) {
  switch (name) {
    case 'get_dashboard_summary':
      return dashboardService.getPatientSummary(effectivePatientId);
    case 'get_medications':
      return medicineService.getMedicines(effectivePatientId, input?.search || '');
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

/**
 * Resuelve sobre qué paciente debe operar la conversación. Si no se pide un
 * patientId (o es el propio usuario), el usuario habla de sí mismo. Si se
 * pide el de otra persona, se exige una relación de cuidador activa y
 * aceptada con ese paciente.
 */
async function resolveEffectivePatientId(userId, requestedPatientId) {
  if (!requestedPatientId || String(requestedPatientId) === String(userId)) {
    return userId;
  }

  const relationship = await CaregiverRelationship.findActiveRelation(userId, requestedPatientId);

  if (!relationship) {
    throw createHttpError(
      403,
      'No tienes una relación activa y aceptada con este paciente.',
      'forbidden_relationship',
    );
  }

  return requestedPatientId;
}

/**
 * Verifica que el usuario no haya superado el límite diario de mensajes del
 * plan gratuito. Los usuarios con plan premium no tienen límite.
 */
async function enforceUsageLimit(userId) {
  const subscription = await subscriptionService.getOrCreateSubscription(userId);

  if (subscription.plan.code !== 'free') {
    return;
  }

  const usedToday = await messageModel.countUserMessagesToday(userId);

  if (usedToday >= FREE_DAILY_MESSAGE_LIMIT) {
    throw createHttpError(
      429,
      `Alcanzaste tu límite de ${FREE_DAILY_MESSAGE_LIMIT} mensajes diarios con Tuchi IA en el plan gratuito. Mejora a premium para mensajes ilimitados.`,
      'chatbot_daily_limit_reached',
    );
  }
}

/**
 * Llama a Bedrock (Converse Stream) y acumula el contenido completo del
 * turno, invocando onTextDelta con cada fragmento de texto a medida que
 * llega (para poder retransmitirlo en vivo por SSE).
 */
async function converseStreamAccumulate(messages, systemPrompt, onTextDelta) {
  let response;

  try {
    response = await getClient().send(new ConverseStreamCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
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

  const blocks = [];
  let stopReason = null;

  try {
    for await (const event of response.stream) {
      if (event.contentBlockStart) {
        const { start, contentBlockIndex } = event.contentBlockStart;
        blocks[contentBlockIndex] = start?.toolUse
          ? { type: 'toolUse', toolUseId: start.toolUse.toolUseId, name: start.toolUse.name, inputJson: '' }
          : { type: 'text', text: '' };
      } else if (event.contentBlockDelta) {
        const { delta, contentBlockIndex } = event.contentBlockDelta;

        // Bedrock no siempre emite contentBlockStart para bloques de texto
        // (solo para toolUse); inicializamos el bloque de forma perezosa.
        if (!blocks[contentBlockIndex]) {
          blocks[contentBlockIndex] = delta?.toolUse
            ? { type: 'toolUse', toolUseId: null, name: null, inputJson: '' }
            : { type: 'text', text: '' };
        }

        const block = blocks[contentBlockIndex];

        if (delta?.text) {
          block.text += delta.text;
          if (onTextDelta) {
            onTextDelta(delta.text);
          }
        } else if (delta?.toolUse?.input) {
          block.inputJson += delta.toolUse.input;
        }
      } else if (event.messageStop) {
        stopReason = event.messageStop.stopReason;
      } else if (event.internalServerException || event.modelStreamErrorException || event.throttlingException || event.validationException) {
        const streamError = event.internalServerException || event.modelStreamErrorException
          || event.throttlingException || event.validationException;
        throw createHttpError(502, 'Tuchi IA tuvo un problema respondiendo.', 'chatbot_stream_error', streamError.message);
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw createHttpError(502, 'Tuchi IA tuvo un problema respondiendo.', 'chatbot_stream_error', error.message);
  }

  const content = blocks.filter(Boolean).map((block) => {
    if (block.type === 'toolUse') {
      let input = {};
      try {
        input = block.inputJson ? JSON.parse(block.inputJson) : {};
      } catch (_parseError) {
        input = {};
      }
      return { toolUse: { toolUseId: block.toolUseId, name: block.name, input } };
    }
    return { text: block.text };
  });

  return { content, stopReason };
}

/**
 * Corre el ciclo de conversación (incluyendo el uso de herramientas) contra
 * Bedrock, transmitiendo cada fragmento de texto en vivo vía onTextDelta.
 */
async function runConversationLoop(effectivePatientId, messages, systemPrompt, onTextDelta) {
  let fullText = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const { content, stopReason } = await converseStreamAccumulate(messages, systemPrompt, onTextDelta);

    const textParts = content.filter((block) => block.text).map((block) => block.text).join('');
    if (textParts) {
      fullText += (fullText ? '\n' : '') + textParts;
    }

    if (stopReason !== 'tool_use') {
      break;
    }

    messages.push({ role: 'assistant', content });

    const toolResultContent = [];

    for (const block of content) {
      if (!block.toolUse) {
        continue;
      }

      let result;

      try {
        result = await runTool(block.toolUse.name, block.toolUse.input, effectivePatientId);
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

  return fullText.trim() || 'Lo siento, no pude generar una respuesta en este momento. Intenta de nuevo en unos minutos.';
}

async function prepareConversation(userId, conversationId, patientId, userMessage) {
  if (!userMessage || !userMessage.trim()) {
    throw createHttpError(400, 'El mensaje no puede estar vacío.', 'empty_message');
  }

  await enforceUsageLimit(userId);

  const effectivePatientId = await resolveEffectivePatientId(userId, patientId);

  let conversation = conversationId
    ? await conversationModel.findByIdForUser(conversationId, userId)
    : null;

  if (!conversation) {
    conversation = await conversationModel.create(
      userId,
      userMessage.trim().slice(0, 60),
      effectivePatientId !== userId ? effectivePatientId : null,
    );
  }

  await messageModel.create(conversation.id, 'user', userMessage.trim());

  const history = await messageModel.findByConversationId(conversation.id);
  const messages = history.map((entry) => ({
    role: entry.role,
    content: [{ text: entry.content }],
  }));

  return { conversation, effectivePatientId, messages };
}

/**
 * Envía un mensaje del usuario a Tuchi IA y retorna la respuesta completa
 * (sin streaming). Util para clientes que no consumen SSE.
 */
async function sendMessage(userId, conversationId, userMessage, patientId) {
  const { conversation, effectivePatientId, messages } = await prepareConversation(
    userId, conversationId, patientId, userMessage,
  );

  const systemPrompt = buildSystemPrompt(effectivePatientId !== userId);
  const finalText = await runConversationLoop(effectivePatientId, messages, systemPrompt, null);

  const assistantMessage = await messageModel.create(conversation.id, 'assistant', finalText);
  await conversationModel.touch(conversation.id);

  return {
    conversationId: conversation.id,
    message: assistantMessage,
  };
}

/**
 * Igual que sendMessage, pero transmite cada fragmento de texto en vivo a
 * través de los callbacks provistos (para exponerlo como Server-Sent Events).
 */
async function sendMessageStream(userId, conversationId, userMessage, patientId, handlers) {
  const { conversation, effectivePatientId, messages } = await prepareConversation(
    userId, conversationId, patientId, userMessage,
  );

  if (handlers.onMeta) {
    handlers.onMeta({ conversationId: conversation.id });
  }

  const systemPrompt = buildSystemPrompt(effectivePatientId !== userId);
  const finalText = await runConversationLoop(effectivePatientId, messages, systemPrompt, handlers.onDelta);

  const assistantMessage = await messageModel.create(conversation.id, 'assistant', finalText);
  await conversationModel.touch(conversation.id);

  if (handlers.onDone) {
    handlers.onDone({ conversationId: conversation.id, message: assistantMessage });
  }
}

async function getConversations(userId, patientId) {
  const effectivePatientId = patientId && String(patientId) !== String(userId)
    ? await resolveEffectivePatientId(userId, patientId)
    : null;

  return conversationModel.findAllByUserId(userId, effectivePatientId);
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
  sendMessageStream,
  getConversations,
  getMessages,
};
