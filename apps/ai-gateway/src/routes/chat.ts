/**
 * SPEC-047 T102 — POST /v1/chat/completions
 * Passthrough to LiteLLM, applies PT-BR filter on response content.
 * Anti-hardcoded: upstream URL + key via process.env.
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';
import { ChatCompletionRequestSchema } from '../schemas.js';
import { applyPtbrFilter } from '../middleware/ptbr-filter';

const LITELLM_URL = process.env.LITELLM_LOCAL_URL ?? 'http://localhost:4000/v1';
const LITELLM_KEY = process.env.LITELLM_MASTER_KEY ?? '';

export async function chatCompletionsRoute(app: FastifyInstance) {
  app.post('/chat/completions', async (request, reply) => {
    const parsed = ChatCompletionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: parsed.error.message, type: 'invalid_request_error' } });
    }

    const body = parsed.data;
    const acceptLang = request.headers['accept-language'];

    try {
      const upstream = await $fetch<Record<string, unknown>>(`${LITELLM_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${LITELLM_KEY}`, 'Content-Type': 'application/json' },
        body,
        timeout: 30000,
      });

      // Apply PT-BR filter to each choice's content
      if (Array.isArray(upstream.choices) && body['x-ptbr-filter'] !== false) {
        for (const choice of upstream.choices as Array<{ message?: { content?: string } }>) {
          if (typeof choice.message?.content === 'string') {
            choice.message.content = await applyPtbrFilter(choice.message.content, acceptLang);
          }
        }
      }

      // Strip debug header in production
      if (process.env.NODE_ENV !== 'development') {
        delete upstream['x-ai-gateway-upstream'];
      }

      return reply.send(upstream);
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'Upstream error', type: 'upstream_error' } });
    }
  });
}
