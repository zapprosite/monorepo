/**
 * SPEC-048 — POST /v1/audio/speech
 * Replicado de speak.sh: texto → PT-BR filter (tom-cat-8b) → TTS Bridge :8013 → Kokoro
 * Default voice: pm_santa (SPEC-009). tts-1-hd → pf_dora.
 * Anti-hardcoded: TTS_BRIDGE_URL via process.env
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';
import { AudioSpeechRequestSchema } from '../schemas.js';
import { applyPtbrFilter } from '../middleware/ptbr-filter.js';

const TTS_BRIDGE_URL = process.env.TTS_BRIDGE_URL ?? 'http://localhost:8013';

// tts-1-hd → pf_dora (alta qualidade feminino PT-BR)
const MODEL_VOICE_MAP: Record<string, string> = {
  'tts-1': 'pm_santa',
  'tts-1-hd': 'pf_dora',
};

export async function audioSpeechRoute(app: FastifyInstance) {
  app.post('/audio/speech', async (request, reply) => {
    const parsed = AudioSpeechRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, type: 'invalid_request_error' } });
    }

    const { model, input, voice, speed, response_format } = parsed.data;

    // Escolher voz: se cliente pediu pm_santa/pf_dora explicitamente usa essa;
    // senão mapa do model (tts-1 → pm_santa, tts-1-hd → pf_dora)
    const resolvedVoice = (['pm_santa', 'pf_dora'] as string[]).includes(voice)
      ? voice
      : (MODEL_VOICE_MAP[model] ?? 'pm_santa');

    // PT-BR filter SEMPRE para TTS (replica lógica de preprocess_for_tts em speak.sh)
    const cleanedInput = await applyPtbrFilter(input, undefined, 'tts');

    try {
      const audio = await $fetch<Blob>(`${TTS_BRIDGE_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          model: 'kokoro',
          input: cleanedInput,
          voice: resolvedVoice,
          speed,
          response_format,
        },
        responseType: 'blob',
        timeout: 30000,
      });

      reply.header('Content-Type', `audio/${response_format}`);
      return reply.send(Buffer.from(await audio.arrayBuffer()));
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      return reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'TTS upstream error', type: 'upstream_error' } });
    }
  });
}
