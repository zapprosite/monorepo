/**
 * SPEC-048 — GET /v1/models
 * Lista modelos reais do homelab expostos como aliases OpenAI
 */

import type { FastifyInstance } from 'fastify';

const CREATED = Math.floor(new Date('2026-04-15').getTime() / 1000);

export async function modelsRoute(app: FastifyInstance) {
  app.get('/models', async () => ({
    object: 'list',
    data: [
      // Texto PT-BR → llama3-portuguese-tomcat-8b via Ollama
      { id: 'gpt-4o', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      { id: 'gpt-4o-mini', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      { id: 'gpt-3.5-turbo', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      // Visão → llava-phi3 (3.8B, 2.5GB VRAM) via Ollama [qwen2.5-vl PRUNED 2026-04-15]
      { id: 'gpt-4o-vision', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      { id: 'gpt-4-vision-preview', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      // TTS → Kokoro via TTS Bridge (pm_santa=tts-1, pf_dora=tts-1-hd)
      { id: 'tts-1', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      { id: 'tts-1-hd', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      // STT → wav2vec2-large-xlsr-53-portuguese :8202 (CANONICAL)
      { id: 'whisper-1', object: 'model', created: CREATED, owned_by: 'zappro-homelab' },
      // Embeddings → nomic-embed-text via Ollama
      {
        id: 'text-embedding-3-small',
        object: 'model',
        created: CREATED,
        owned_by: 'zappro-homelab',
      },
    ],
  }));
}
