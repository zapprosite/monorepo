/**
 * HVAC RAG JSON Schemas — used by Fastify for request/response validation.
 * Follows the Zod-first rule: validation shapes are defined here as plain
 * Fastify JSON Schema objects (not Zod) because Fastify's schema compiler
 * is JSON Schema-native. Zod schemas live in packages/zod-schemas.
 */

/** POST /api/hvac/query — request body schema */
export const hvacQueryBodySchema = {
	type: 'object',
	required: ['query'],
	properties: {
		query: {
			type: 'string',
			minLength: 1,
			maxLength: 2000,
			description: 'Pergunta técnica HVAC em linguagem natural.',
		},
		brand: {
			type: 'string',
			maxLength: 100,
			description: 'Marca do equipamento (ex: LG, Daikin, Springer).',
		},
		session_id: {
			type: 'string',
			maxLength: 128,
			description: 'ID de sessão para continuidade do contexto de conversa.',
		},
		model: {
			type: 'string',
			maxLength: 100,
			description: 'Modelo público do pipe (default: zappro-clima-tutor).',
		},
	},
	additionalProperties: false,
} as const;

/** POST /api/hvac/query — response body schema (200 OK) */
export const hvacQueryResponseSchema = {
	type: 'object',
	required: ['answer', 'evidence_level', 'source', 'session_id'],
	properties: {
		answer: {
			type: 'string',
			description: 'Resposta do tutor HVAC em português.',
		},
		evidence_level: {
			type: 'string',
			enum: ['manual_exato', 'manual_familia', 'triagem_tecnica', 'official_web', 'web_fallback', 'sem_contexto', 'fallback', 'unknown'],
			description: 'Nível de evidência da resposta.',
		},
		source: {
			type: 'string',
			description: 'Origem da resposta (hvac_rag_pipe | fallback).',
		},
		session_id: {
			type: 'string',
			description: 'ID de sessão utilizado na consulta.',
		},
		model: {
			type: 'string',
			description: 'Modelo de linguagem utilizado.',
		},
		citations: {
			type: 'array',
			description: 'Citações indexadas dos trechos do manual usados na resposta [Manual X, pág Y].',
			items: {
				type: 'object',
				properties: {
					doc_id: { type: 'string' },
					heading: { type: 'string' },
					page_start: { type: ['number', 'null'] },
					page_end: { type: ['number', 'null'] },
					doc_type: { type: 'string' },
				},
			},
		},
	},
	additionalProperties: false,
} as const;
