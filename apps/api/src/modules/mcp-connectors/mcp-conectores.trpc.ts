import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	mcpConectorCreateInputZod,
	mcpConectorUpdateInputZod,
} from "@connected-repo/zod-schemas/mcp-conectores.zod";
import { db } from "@backend/db/db";
import { TRPCError } from "@trpc/server";
import z from "zod";

// Helper to verify team access via clienteId
async function verifyTeamAccess(clienteId: string, teamId: string): Promise<void> {
	const client = await db.clients.findOptional(clienteId);
	if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
	if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado ao cliente" });
}

// Helper to verify connector belongs to team (direct teamId check)
async function verifyConectorTeamAccess(conectorId: string, teamId: string) {
	const conector = await db.mcpConectores.findOptional(conectorId);
	if (!conector) throw new TRPCError({ code: "NOT_FOUND", message: "Conector não encontrado" });
	if (conector.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado ao conector" });
	return conector;
}

export const mcpConectorRouter = trpcRouter({
	create: protectedProcedure
		.input(mcpConectorCreateInputZod)
		.mutation(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			await verifyTeamAccess(input.clienteId, teamId);
			const conector = await db.mcpConectores.insert({
				provider: input.provider,
				apiKey: input.apiKey,
				configuracao: input.configuracao,
				clienteId: input.clienteId,
				usuarioCriacaoId: ctx.user.userId,
				status: "pendente",
			});
			return conector;
		}),

	list: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid().optional() }))
		.query(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			// Filter by teamId directly
			const conectores = await db.mcpConectores
				.where({ teamId })
				.select("*");
			return conectores;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			await verifyConectorTeamAccess(input.id, teamId);
			const conector = await db.mcpConectores
				.where({ id: input.id })
				.select("*")
				.take();
			if (!conector) throw new TRPCError({ code: "NOT_FOUND" });
			return conector;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: mcpConectorUpdateInputZod,
			})
		)
		.mutation(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			await verifyConectorTeamAccess(input.id, teamId);
			const updated = await db.mcpConectores
				.where({ id: input.id })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			await verifyConectorTeamAccess(input.id, teamId);
			const deleted = await db.mcpConectores
				.where({ id: input.id })
				.delete();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),

	updateStatus: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				status: z.enum(["ativo", "inativo", "erro", "pendente"]),
				erroMensagem: z.string().optional(),
			})
		)
		.mutation(async ({ input, ctx }) => {
			const { teamId } = ctx.user;
			await verifyConectorTeamAccess(input.id, teamId);
			const updated = await db.mcpConectores
				.where({ id: input.id })
				.update({
					status: input.status,
					erroUltimaTentativa: input.erroMensagem || null,
					ultimaTentativaSync: new Date(),
				});
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),
});
