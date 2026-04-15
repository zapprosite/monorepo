/**
 * SPEC-048 — POST /v1/audio/transcriptions
 *
 * STT routing (por qualidade PT-BR):
 *   STT_DIRECT_URL=:8202 → wav2vec2-large-xlsr-53-portuguese (MELHOR para PT-BR nativo)
 *   STT_PROXY_URL=:8203  → wav2vec2-deepgram-proxy → whisper-small (para OpenClaw/Deepgram compat)
 *   :8201                → whisper-small directo (NÃO usar para PT-BR — qualidade baixa)
 *
 * O gateway usa :8202 (wav2vec2) por defeito para máxima qualidade PT-BR.
 * Anti-hardcoded: STT_DIRECT_URL via process.env
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';

// :8202 = wav2vec2-large-xlsr-53-portuguese (nativo PT-BR, 82%+ accuracy)
// :8201 = whisper-small (multilingual, mau em PT-BR)
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8202';

export async function audioTranscriptionsRoute(app: FastifyInstance) {
  app.post('/audio/transcriptions', async (request, reply) => {
    try {
      const contentType = request.headers['content-type'] ?? 'multipart/form-data';
      const body = request.body as Buffer | string;

      const result = await $fetch<{ text?: string }>(`${STT_URL}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
        timeout: 60000,
      });

      return reply.send({ text: result?.text ?? '' });
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      return reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'STT upstream error', type: 'upstream_error' } });
    }
  });
}
