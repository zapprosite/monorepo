/**
 * SPEC-047 T104 — POST /v1/audio/transcriptions
 * Passthrough to wav2vec2-proxy (:8203, Deepgram-format) (SPEC-018).
 * Anti-hardcoded: STT_PROXY_URL via process.env.
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';

const STT_PROXY_URL = process.env.STT_PROXY_URL ?? 'http://localhost:8203';

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  // Register multipart support inline (file upload)
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      // Forward multipart/form-data as-is to STT proxy (Deepgram v1/listen format)
      const body = (await request.body) as Buffer | string;
      const contentType = request.headers['content-type'] ?? 'multipart/form-data';

      const result = await $fetch<{
        results: { channels: Array<{ alternatives: Array<{ transcript: string }> }> };
      }>(`${STT_PROXY_URL}/v1/listen`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
        timeout: 30000,
      });

      // Normalize Deepgram response → OpenAI transcription format
      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
      return reply.send({ text: transcript });
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'STT upstream error', type: 'upstream_error' } });
    }
  });
}
