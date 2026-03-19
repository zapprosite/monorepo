import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	mcpConectorCreateInputZod,
	mcpConectorUpdateInputZod,
} from "@connected-repo/zod-schemas/mcp-conectores.zod";
import { db } from "@backend/db/db";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const mcpConectorRouter = trpcRouter({
	create: protectedProcedure
		.input(mcpConectorCreateInputZod)
		.mutation(async ({ input, ctx }) => {
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
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ input }) => {
			const conectores = await db.mcpConectores
				.where({ clienteId: input.clienteId })
				.select("*");
			return conectores;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
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
		.mutation(async ({ input }) => {
			const updated = await db.mcpConectores
				.where({ id: input.id })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
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
		.mutation(async ({ input }) => {
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
