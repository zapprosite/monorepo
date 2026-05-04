import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { TRPCError } from '@trpc/server';
import z from 'zod';
import {
	hermesHealth,
	listQdrantCollections,
	saveMemory,
	searchMemories,
} from './memory.client';

export const memoryRouterTrpc = trpcRouter({
	/**
	 * List available Qdrant collections (replaces Trieve datasets)
	 */
	listCollections: protectedProcedure.query(async () => {
		try {
			const collections = await listQdrantCollections();
			// Map collections to dataset-like objects for frontend compatibility
			return collections.map((c) => ({
				id: c.name,
				name: c.name,
				description: `Qdrant collection: ${c.name}`,
			}));
		} catch (cause) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Failed to list Qdrant collections',
				cause,
			});
		}
	}),

	/**
	 * Search memories via Hermes Second Brain (Mem0 + Qdrant)
	 * Replaces Trieve RAG search
	 */
	search: protectedProcedure
		.input(
			z.object({
				query: z.string().min(1),
				datasetId: z.string().optional(), // collection name (optional filter)
				limit: z.number().int().positive().default(5),
			}),
		)
		.query(async ({ input }) => {
			try {
				const results = await searchMemories(input.query, input.limit);
				// Normalize results to chunk-like shape for frontend compatibility
				return results.map((r) => ({
					id: r.id,
					content: r.memory,
					score: r.score ?? 0,
					metadata: r.metadata ?? {},
					source: (r.metadata?.source as string) ?? 'memory',
				}));
			} catch (cause) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Memory search failed',
					cause,
				});
			}
		}),

	/**
	 * Save a memory to Hermes Second Brain
	 */
	create: protectedProcedure
		.input(
			z.object({
				text: z.string().min(1),
				tags: z.array(z.string()).optional(),
				source: z.string().default('manual'),
				agent_id: z.string().optional(),
				run_id: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				return saveMemory(input);
			} catch (cause) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to save memory',
					cause,
				});
			}
		}),

	/**
	 * Health check for Hermes Second Brain
	 */
	health: protectedProcedure.query(async () => {
		try {
			return await hermesHealth();
		} catch (cause) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Hermes Second Brain is unreachable',
				cause,
			});
		}
	}),
});
