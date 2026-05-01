/**
 * SPEC-048 — POST /v1/audio/speech
 * Pipeline: texto → PT-BR filter (PTBR_FILTER_MODEL) → TTS Bridge → edge-tts
 * edge-tts PT-BR Neural voices: pt-BR-AntonioNeural (male), pt-BR-FranciscaNeural (female),
 *   pt-BR-ThalitaMultilingualNeural (female multilingual)
 * Anti-hardcoded: TTS_BRIDGE_URL via process.env
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';
import { AudioSpeechRequestSchema } from '../schemas.js';
import { applyPtbrFilter } from '../middleware/ptbr-filter.js';

const TTS_BRIDGE_URL = process.env['TTS_BRIDGE_URL'] ?? 'http://localhost:8012';

// edge-tts: tts-1 → AntonioNeural (male), tts-1-hd → FranciscaNeural (female HD)
const MODEL_VOICE_MAP: Record<string, string> = {
  'tts-1': 'pt-BR-AntonioNeural',
  'tts-1-hd': 'pt-BR-FranciscaNeural',
};

export async function audioSpeechRoute(app: FastifyInstance) {
  app.post('/audio/speech', async (request, reply) => {
    const parsed = AudioSpeechRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, type: 'invalid_request_error' } });
    }

    const { model, input, voice: inputVoice, speed, response_format } = parsed.data;

    // Validar voz — edge-tts PT-BR Neural only
    const allowedVoices = ['pt-BR-AntonioNeural', 'pt-BR-FranciscaNeural', 'pt-BR-ThalitaMultilingualNeural'];
    const voice = MODEL_VOICE_MAP[model] ?? inputVoice;
    if (!allowedVoices.includes(voice)) {
      return reply.status(400).send({
        error: {
          message: `Invalid voice: '${voice}'. Allowed voices: ${allowedVoices.join(', ')}`,
          type: 'invalid_request_error',
          code: 'voice_not_allowed',
        },
      });
    }

    // PT-BR filter SEMPRE para TTS (replica lógica de preprocess_for_tts em speak.sh)
    const cleanedInput = await applyPtbrFilter(input, undefined, 'tts');

    try {
      const audio = await $fetch<ArrayBuffer, 'arrayBuffer'>(`${TTS_BRIDGE_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          model: '',
          input: cleanedInput,
          voice: voice,
          speed,
          response_format,
        },
        responseType: 'arrayBuffer',
        timeout: 30000,
      });

      reply.header('Content-Type', `audio/${response_format}`);
      return reply.send(Buffer.from(audio));
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      return reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'TTS upstream error', type: 'upstream_error' } });
    }
  });
}
