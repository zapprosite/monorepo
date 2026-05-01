/**
 * SPEC-047/048 — AI Gateway (OpenAI-compat facade)
 * Anti-hardcoded: all config via process.env
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatCompletionsRoute } from './routes/chat.js';
import { audioSpeechRoute } from './routes/audio-speech.js';
import { audioTranscriptionsRoute } from './routes/audio-transcriptions.js';
import { modelsRoute } from './routes/models.js';
import { authMiddleware } from './middleware/auth.js';

const PORT = parseInt(process.env['AI_GATEWAY_PORT'] ?? '4002', 10);
const HOST = process.env['AI_GATEWAY_HOST'] ?? '0.0.0.0';

async function start() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    bodyLimit: 50 * 1024 * 1024, // 50MB for audio files
  });

  await app.register(cors, { origin: true });

  // Accept multipart/form-data as raw Buffer (for /v1/audio/transcriptions)
  app.addContentTypeParser('multipart/form-data', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.addHook('onRequest', authMiddleware);

  await app.register(chatCompletionsRoute, { prefix: '/v1' });
  await app.register(audioSpeechRoute, { prefix: '/v1' });
  await app.register(audioTranscriptionsRoute, { prefix: '/v1' });
  await app.register(modelsRoute, { prefix: '/v1' });

  app.get('/health', async () => ({ status: 'ok', service: 'ai-gateway' }));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`ai-gateway listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
