/**
 * SPEC-048 — POST /v1/chat/completions
 * - gpt-4o / gpt-3.5-turbo → LiteLLM :4000 (tom-cat-8b: llama3-portuguese-tomcat-8b)
 * - gpt-4o-vision → LiteLLM :4000 (llava-phi3: 3.8B, 2.5GB VRAM) — multimodal
 *   [qwen2.5-vl:7b PRUNED 2026-04-15 — substituído por llava-phi3 (mais leve)]
 * - PT-BR filter opcional via header x-ptbr-filter: true
 * Anti-hardcoded: tudo via process.env. OLLAMA_VISION_MODEL via env.
 */

import type { FastifyInstance } from 'fastify';
import { $fetch } from 'ofetch';
import { ChatCompletionRequestSchema } from '../schemas.js';
import { applyPtbrFilter } from '../middleware/ptbr-filter.js';

const LITELLM_URL = process.env['LITELLM_LOCAL_URL'] ?? 'http://localhost:4000/v1';
const LITELLM_KEY = process.env['LITELLM_MASTER_KEY'] ?? '';

// Vision model: anti-hardcoded via env (qwen2.5-vl PRUNED 2026-04-15 → llava-phi3)
const VISION_MODEL = process.env['OLLAMA_VISION_MODEL'] ?? 'llava-phi3';

// OpenAI alias → LiteLLM model name (espelha config.yaml real)
const MODEL_ALIASES: Record<string, string> = {
  'gpt-4o': 'tom-cat-8b', // llama3-portuguese-tomcat-8b via Ollama
  'gpt-4o-mini': 'tom-cat-8b',
  'gpt-3.5-turbo': 'tom-cat-8b',
  'gpt-4o-vision': VISION_MODEL, // llava-phi3 (3.8B, 2.5GB) — OLLAMA_VISION_MODEL
  'gpt-4-vision-preview': VISION_MODEL,
  // passthrough
  'tom-cat-8b': 'tom-cat-8b',
  'llava-phi3': 'llava-phi3',
  'llava-phi3:latest': 'llava-phi3',
};

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
    const ptbrEnabled =
      request.headers['x-ptbr-filter'] === 'true' ||
      (typeof acceptLang === 'string' && acceptLang.toLowerCase().includes('pt'));
    const upstreamModel = MODEL_ALIASES[body.model] ?? body.model;

    try {
      const upstream = await $fetch<Record<string, unknown>>(`${LITELLM_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${LITELLM_KEY}`, 'Content-Type': 'application/json' },
        body: { ...body, model: upstreamModel },
        timeout: 60000,
      });

      if (ptbrEnabled && Array.isArray(upstream['choices'])) {
        for (const choice of upstream['choices'] as Array<{ message?: { content?: string } }>) {
          if (typeof choice.message?.content === 'string') {
            choice.message.content = await applyPtbrFilter(choice.message.content, acceptLang);
          }
        }
      }

      // Devolver alias original ao cliente
      if (upstream['model']) upstream['model'] = body.model;
      if (process.env['NODE_ENV'] !== 'development') delete upstream['x-ai-gateway-upstream'];

      return reply.send(upstream);
    } catch (err: unknown) {
      const e = err as { data?: unknown; statusCode?: number };
      return reply
        .code(e.statusCode ?? 502)
        .send(e.data ?? { error: { message: 'Upstream error', type: 'upstream_error' } });
    }
  });
}
