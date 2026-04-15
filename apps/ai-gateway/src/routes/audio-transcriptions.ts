/**
 * SPEC-048 — POST /v1/audio/transcriptions
 * Passthrough para whisper-api :8201 (OpenAI-compat nativo, Faster-Whisper)
 * Não usa wav2vec2-proxy :8203 (Deepgram format) — usa directamente :8201
 * Anti-hardcoded: STT_DIRECT_URL via process.env
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';

// :8201 = whisper-api (OpenAI /v1/audio/transcriptions nativo)
// :8203 = wav2vec2-proxy (Deepgram format — para OpenClaw)
const STT_URL = process.env.STT_DIRECT_URL ?? process.env.STT_PROXY_URL ?? 'http://localhost:8201';

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      const contentType = request.headers['content-type'] ?? 'multipart/form-data';
      const body = request.body as Buffer | string;

      const result = await $fetch<{ text?: string; results?: unknown }>(
        `${STT_URL}/v1/audio/transcriptions`,
        {
          method: 'POST',
          headers: { 'Content-Type': contentType },
          body,
          timeout: 60000,
        },
      );

      // whisper-api :8201 já retorna OpenAI format {"text":"..."}
      return reply.send({ text: result?.text ?? '' });
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      return reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'STT upstream error', type: 'upstream_error' } });
    }
  });
}
