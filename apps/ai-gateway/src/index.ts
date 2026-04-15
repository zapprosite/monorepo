/**
 * SPEC-047 — AI Gateway
 * OpenAI-compatible facade → LiteLLM / TTS Bridge / STT Proxy
 * PT-BR Llama filter middleware
 * Anti-hardcoded: all config via process.env
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatCompletionsRoute } from './routes/chat';
import { audioSpeechRoute } from './routes/audio-speech';
import { audioTranscriptionsRoute } from './routes/audio-transcriptions';
import { modelsRoute } from './routes/models';
import { authMiddleware } from './middleware/auth';

const PORT = parseInt(process.env.AI_GATEWAY_PORT ?? '4002', 10);
const HOST = process.env.AI_GATEWAY_HOST ?? '0.0.0.0';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

await app.register(cors, { origin: true });

// Auth on all /v1/* routes
app.addHook('onRequest', authMiddleware);

// Routes
await app.register(chatCompletionsRoute, { prefix: '/v1' });
await app.register(audioSpeechRoute, { prefix: '/v1' });
await app.register(audioTranscriptionsRoute, { prefix: '/v1' });
await app.register(modelsRoute, { prefix: '/v1' });

// Health — no auth
app.get('/health', async () => ({ status: 'ok', service: 'ai-gateway' }));

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`ai-gateway listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
