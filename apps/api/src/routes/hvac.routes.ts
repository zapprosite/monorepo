/**
 * HVAC RAG Routes — REST proxy for Open WebUI
 *
 * Exposes a Fastify REST endpoint that forwards queries to the
 * hvac_rag_pipe.py service (port 4017) and returns structured JSON.
 *
 * Endpoint:
 *   POST /api/hvac/query
 *   GET  /api/hvac/health
 *
 * Authentication: INTERNAL_API_SECRET header (x-api-secret)
 * This allows Open WebUI Tools to call it without a session cookie.
 */

import { env } from '@backend/configs/env.config';
import type { FastifyInstance } from 'fastify';
import { hvacQueryBodySchema, hvacQueryResponseSchema } from './hvac.schema';
import { callHvacPipe, hvacPipeHealth } from './hvac.client';

/** Internal API secret guard — allows Open WebUI to call without session. */
function validateApiSecret(secret: string | undefined): boolean {
	if (!env.INTERNAL_API_SECRET) return true; // not configured = open (dev only)
	return secret === env.INTERNAL_API_SECRET;
}

export const hvacRouter = (app: FastifyInstance) => {
	/**
	 * POST /api/hvac/query
	 *
	 * Body: { query: string, brand?: string, session_id?: string, model?: string }
	 * Returns: { answer: string, evidence_level: string, source: string, session_id: string }
	 *
	 * Authentication: x-api-secret header (matches INTERNAL_API_SECRET env var)
	 */
	app.post(
		'/query',
		{
			schema: {
				body: hvacQueryBodySchema,
				response: {
					200: hvacQueryResponseSchema,
					401: {
						type: 'object',
						properties: {
							statusCode: { type: 'number' },
							error: { type: 'string' },
							message: { type: 'string' },
						},
					},
					503: {
						type: 'object',
						properties: {
							status: { type: 'string' },
							error: { type: 'string' },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const apiSecret = request.headers['x-api-secret'] as string | undefined;

			if (!validateApiSecret(apiSecret)) {
				return reply.status(401).send({
					statusCode: 401,
					error: 'Unauthorized',
					message: 'x-api-secret inválido ou ausente',
				});
			}

			const body = request.body as {
				query: string;
				brand?: string;
				session_id?: string;
				model?: string;
			};

			app.log.info(
				{ query_len: body.query.length, brand: body.brand ?? 'unset', session_id: body.session_id ?? 'none' },
				'[hvac-route] POST /api/hvac/query',
			);

			const result = await callHvacPipe(body);

			return reply.send(result);
		},
	);

	/**
	 * GET /api/hvac/health
	 *
	 * Proxies the /health endpoint of hvac_rag_pipe.py.
	 * Useful for monitoring dashboards and Open WebUI startup checks.
	 */
	app.get('/health', async (_request, reply) => {
		const health = await hvacPipeHealth();
		const statusCode = health.status === 'ok' ? 200 : 503;
		return reply.status(statusCode).send(health);
	});
};
