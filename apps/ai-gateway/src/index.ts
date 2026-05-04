/**
 * SPEC-047/048 — Voice Gateway (OpenAI-compat facade for TTS + STT)
 *
 * Mínimo viável de proxy/router:
 *   • LiteLLM :4018/v1  → text, code, instruction, embedding (gateway canônico LLM)
 *   • ai-gateway :4002  → voice ONLY: /v1/audio/speech (TTS) + /v1/audio/transcriptions (STT)
 *
 * Anti-hardcoded: all config via process.env
 */

import cors from '@fastify/cors';
import Fastify from 'fastify';
import { authMiddleware } from './middleware/auth.js';
import { audioSpeechRoute } from './routes/audio-speech.js';
import { audioTranscriptionsRoute } from './routes/audio-transcriptions.js';

const PORT = parseInt(process.env.AI_GATEWAY_PORT ?? '4002', 10);
const HOST = process.env.AI_GATEWAY_HOST ?? '0.0.0.0';

async function start() {
	const app = Fastify({
		logger: { level: process.env.LOG_LEVEL ?? 'info' },
		bodyLimit: 50 * 1024 * 1024, // 50MB for audio files
	});

	await app.register(cors, { origin: true });

	// Accept multipart/form-data as raw Buffer (for /v1/audio/transcriptions)
	app.addContentTypeParser('multipart/form-data', { parseAs: 'buffer' }, (_req, body, done) => {
		done(null, body);
	});

	app.addHook('onRequest', authMiddleware);

	// Voice routes ONLY — LLM (chat/models) is served by LiteLLM :4018/v1
	await app.register(audioSpeechRoute, { prefix: '/v1' });
	await app.register(audioTranscriptionsRoute, { prefix: '/v1' });

	app.get('/health', async () => ({ status: 'ok', service: 'ai-gateway' }));

	try {
		await app.listen({ port: PORT, host: HOST });
		app.log.info(`ai-gateway (voice) listening on ${HOST}:${PORT}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

start();
