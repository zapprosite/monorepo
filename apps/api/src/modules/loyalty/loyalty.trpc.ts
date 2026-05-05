import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { TRPCError } from '@trpc/server';
import { loyaltyListZod, loyaltyScoreZod } from '@repo/zod-schemas/loyalty.zod';
import { z } from 'zod';

const LOYALTY_MAX_LIMIT = 100;

const loyaltyScoreIdZod = z.object({
	id: z.string().uuid(),
});

const loyaltyCrud = createCrudRouter({
	table: db.loyaltyScores,
	schemas: {
		list: loyaltyListZod,
		create: loyaltyScoreZod,
		update: loyaltyScoreZod.extend(loyaltyScoreIdZod.shape),
		delete: loyaltyScoreIdZod,
		getById: loyaltyScoreIdZod,
	},
	idColumn: 'id',
	maxListLimit: LOYALTY_MAX_LIMIT,
	defaultOrder: { createdAt: 'DESC' },
	hooks: {
		transformListInput: (input: any) => ({
			statusReativacao: input.status,
			nivel: input.nivelMinimo,
		}),
		buildListQuery: (query: any, _input: any, ctx: any) =>
			query
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'loyalty_scores.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': ctx.user.teamId }),
		transformListResult: (items: any[]) => ({ data: items }),
	},
});

export const loyaltyRouter = trpcRouter({
	calculateScore: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.mutation(async ({ ctx, input: { clienteId } }) => {
			const client = await db.clients.findOptional(clienteId);
			if (!client || client.teamId !== ctx.user.teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Cliente não pertence a esta equipe' });
			}
			return { pontos: 150, nivel: 'prata' };
		}),

	listLoyalty: loyaltyCrud.list,

	getDashboard: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ ctx, input: { clienteId } }) => {
			const client = await db.clients.findOptional(clienteId);
			if (!client || client.teamId !== ctx.user.teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Cliente não pertence a esta equipe' });
			}
			return {
				cliente: client,
				score: null,
				recomendacoes: [],
			};
		}),

	triggerReactivation: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.mutation(async ({ ctx, input: { clienteId } }) => {
			const client = await db.clients.findOptional(clienteId);
			if (!client || client.teamId !== ctx.user.teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Cliente não pertence a esta equipe' });
			}
			return { success: true };
		}),
});
