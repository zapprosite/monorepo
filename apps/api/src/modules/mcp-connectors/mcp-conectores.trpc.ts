import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	mcpConectorCreateInputZod,
	mcpConectorUpdateInputZod,
} from '@repo/zod-schemas/mcp-conectores.zod';
import { TRPCError } from '@trpc/server';
import z from 'zod';

async function verifyClientTeamAccess(clienteId: string, teamId: string): Promise<void> {
	const client = await db.clients.findOptional(clienteId);
	if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
	if (client.teamId !== teamId)
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado ao cliente' });
}

async function verifyConectorTeamAccess(conectorId: string, teamId: string) {
	const conector = await db.mcpConectores.findOptional(conectorId);
	if (!conector) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conector não encontrado' });
	await verifyClientTeamAccess(conector.clienteId, teamId);
	return conector;
}

// @ts-ignore TS2742 — pqb internal type inference not portable
export const mcpConectorRouter = trpcRouter({
	create: protectedProcedure.input(mcpConectorCreateInputZod).mutation(async ({ input, ctx }) => {
		const teamId = ctx.user.teamId!;
		await verifyClientTeamAccess(input.clienteId, teamId);
		const conector = await db.mcpConectores.create({
			provider: input.provider,
			apiKey: input.apiKey,
			configuracao: input.configuracao,
			clienteId: input.clienteId,
			usuarioCriacaoId: ctx.user.userId,
			status: 'pendente',
		});
		return conector;
	}),

	list: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid().optional() }))
		.query(async ({ ctx }) => {
			const teamId = ctx.user.teamId!;
			const clientIds = await db.clients.where({ teamId }).select('clientId');
			const clientIdList = clientIds.map((c) => c.clientId);
			// @ts-ignore — pqb where with array
			const conectores = await db.mcpConectores.where({ clienteId: { in: clientIdList } }).select(
				'id', 'provider', 'status', 'configuracao', 'clienteId', 'usuarioCriacaoId', 'createdAt', 'updatedAt', 'ultimaTentativaSync', 'erroUltimaTentativa',
			);
			return conectores;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
		const conector = await verifyConectorTeamAccess(input.id, teamId!);
			// @ts-ignore — subset select
			return {
				id: conector.id,
				provider: conector.provider,
				status: conector.status,
				configuracao: conector.configuracao,
				clienteId: conector.clienteId,
				usuarioCriacaoId: conector.usuarioCriacaoId,
				createdAt: conector.createdAt,
				updatedAt: conector.updatedAt,
				ultimaTentativaSync: conector.ultimaTentativaSync,
				erroUltimaTentativa: conector.erroUltimaTentativa,
			};
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: mcpConectorUpdateInputZod,
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const teamId = ctx.user.teamId!;
			await verifyConectorTeamAccess(input.id, teamId);
			const updated = await db.mcpConectores.where({ id: input.id }).update(input.data);
			if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const teamId = ctx.user.teamId!;
			await verifyConectorTeamAccess(input.id, teamId);
			const deleted = await db.mcpConectores.where({ id: input.id }).delete();
			if (!deleted) throw new TRPCError({ code: 'NOT_FOUND' });
			return { success: true };
		}),

	updateStatus: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				status: z.enum(['ativo', 'inativo', 'erro', 'pendente']),
				erroMensagem: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const teamId = ctx.user.teamId!;
			await verifyConectorTeamAccess(input.id, teamId);
			const updated = await db.mcpConectores.where({ id: input.id }).update({
				status: input.status,
				erroUltimaTentativa: input.erroMensagem || null,
				ultimaTentativaSync: new Date(),
			});
			if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
			return updated;
		}),
});