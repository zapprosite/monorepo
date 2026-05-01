import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const LoyaltyScoreOutput = z.object({
	clienteId: z.string(),
	pontos: z.number(),
	nivel: z.enum(["bronze", "prata", "ouro", "platinum"]),
	statusReativacao: z.enum(["ativo", "risco-30d", "risco-60d", "risco-90d", "perdido"]),
	ultimaCompra: z.date().optional(),
});

export const loyaltyRouter = trpcRouter({
	calculateScore: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const cliente = await ctx.db.loyalty.findUnique({
				where: { id: input.clienteId, teamId: ctx.user.teamId },
			});
			if (!cliente) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a esta equipe" });
			}
			return { pontos: 150, nivel: "prata" };
		}),

	listLoyalty: protectedProcedure
		.input(
			z.object({
				status: z.enum(["ativo", "risco-30d", "risco-60d", "risco-90d", "perdido"]).optional(),
				nivelMinimo: z.enum(["bronze", "prata", "ouro", "platinum"]).optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const rows = await ctx.db.loyalty.findMany({
				where: { teamId: ctx.user.teamId },
				skip: input.offset,
				take: input.limit,
			});
			return { data: rows };
		}),

	getDashboard: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const cliente = await ctx.db.clientes.findUnique({
				where: { id: input.clienteId, teamId: ctx.user.teamId },
			});
			if (!cliente) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a esta equipe" });
			}
			return {
				cliente,
				score: null,
				recomendacoes: [],
			};
		}),

	triggerReactivation: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const cliente = await ctx.db.clientes.findUnique({
				where: { id: input.clienteId, teamId: ctx.user.teamId },
			});
			if (!cliente) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a esta equipe" });
			}
			return { success: true };
		}),
});
