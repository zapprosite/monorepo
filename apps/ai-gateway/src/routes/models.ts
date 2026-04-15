/**
 * SPEC-047 — GET /v1/models
 * Returns OpenAI-compatible model list with gateway aliases.
 */

import type { FastifyInstance } from 'fastify';

const CREATED = Math.floor(new Date('2026-04-15').getTime() / 1000);

export async function modelsRoute(app: FastifyInstance) {
  app.get('/models', async () => ({
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
      { id: 'gpt-4o-mini', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
      { id: 'gpt-3.5-turbo', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
      { id: 'whisper-1', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
      { id: 'tts-1', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
      { id: 'tts-1-hd', object: 'model', created: CREATED, owned_by: 'zappro-gateway' },
    ],
  }));
}
