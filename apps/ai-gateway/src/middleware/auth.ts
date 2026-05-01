/**
 * Auth middleware — constant-time Bearer token compare (SPEC-047 T105)
 * Token read from process.env['AI_GATEWAY_FACADE_KEY'] (anti-hardcoded)
 */

import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const FACADE_KEY = process.env['AI_GATEWAY_FACADE_KEY'] ?? '';

if (!FACADE_KEY) {
  process.stderr.write('[ai-gateway] FATAL: AI_GATEWAY_FACADE_KEY not set in .env\n');
  process.exit(1);
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip health endpoint
  if (request.url === '/health') return;

  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  let valid = false;
  try {
    const a = Buffer.from(token.padEnd(FACADE_KEY.length));
    const b = Buffer.from(FACADE_KEY);
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    reply
      .code(401)
      .send({ error: { message: 'Invalid API key', type: 'invalid_request_error', code: 401 } });
  }
}
