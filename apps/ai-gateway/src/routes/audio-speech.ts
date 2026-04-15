/**
 * SPEC-047 T103 — POST /v1/audio/speech
 * Passthrough to TTS Bridge (:8013), default voice pm_santa (SPEC-009).
 * Anti-hardcoded: TTS_BRIDGE_URL via process.env.
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';
import { AudioSpeechRequestSchema } from '../schemas.js';

const TTS_BRIDGE_URL = process.env.TTS_BRIDGE_URL ?? 'http://localhost:8013';

export async function audioSpeechRoute(app: FastifyInstance) {
  app.post('/audio/speech', async (request, reply) => {
    const parsed = AudioSpeechRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, type: 'invalid_request_error' } });
    }

    const { input, voice, speed, response_format } = parsed.data;

    try {
      // TTS Bridge expects OpenAI-compatible body — forward as-is
      const audio = await $fetch<Blob>(`${TTS_BRIDGE_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { model: 'kokoro', input, voice, speed, response_format },
        responseType: 'blob',
        timeout: 20000,
      });

      reply.header('Content-Type', `audio/${response_format}`);
      return reply.send(Buffer.from(await audio.arrayBuffer()));
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'TTS upstream error', type: 'upstream_error' } });
    }
  });
}
