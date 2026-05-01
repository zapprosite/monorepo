import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	conteudoCreateInputZod,
	conteudoUpdateInputZod,
	conteudoGetBySlugZod,
	conteudoRevisaoCreateInputZod,
	conteudoRevisaoUpdateInputZod,
} from "@connected-repo/zod-schemas/conteudos.zod";
import { db } from "@backend/db/db";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const conteudoRouter = trpcRouter({
	// Conteúdos
	create: protectedProcedure
		.input(conteudoCreateInputZod)
		.mutation(async ({ input, ctx }) => {
			const conteudo = await db.conteudos.insert({
				teamId: ctx.user.teamId,
				titulo: input.titulo,
				slug: input.slug,
				descricao: input.descricao,
				corpo: input.corpo,
				tipo: input.tipo,
				status: input.status,
				geradoIA: input.geradoIA,
				seoTitulo: input.seoTitulo,
				seoDescricao: input.seoDescricao,
				seoSlug: input.seoSlug,
				metaTags: input.metaTags,
				dataPublicacao: input.dataPublicacao,
				clienteId: input.clienteId,
				autorId: input.autorId || ctx.user.userId,
			});
			return conteudo;
		}),

	list: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const conteudos = await db.conteudos
				.where({ teamId: ctx.user.teamId, clienteId: input.clienteId })
				.select("*")
				.order({ createdAt: "DESC" });
			return conteudos;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const conteudo = await db.conteudos
				.where({ id: input.id, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "NOT_FOUND" });
			return conteudo;
		}),

	getBySlug: protectedProcedure
		.input(conteudoGetBySlugZod)
		.query(async ({ ctx, input }) => {
			const conteudo = await db.conteudos
				.where({
					teamId: ctx.user.teamId,
					slug: input.slug,
					clienteId: input.clienteId,
				})
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "NOT_FOUND" });
			return conteudo;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: conteudoUpdateInputZod,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const updated = await db.conteudos
				.where({ id: input.id, teamId: ctx.user.teamId })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await db.conteudos
				.where({ id: input.id, teamId: ctx.user.teamId })
				.delete();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),

	// Conteúdo Revisões
	createRevisao: protectedProcedure
		.input(conteudoRevisaoCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			// Verify conteudo belongs to team
			const conteudo = await db.conteudos
				.where({ id: input.conteudoId, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "NOT_FOUND" });

			const revisao = await db.conteudoRevisoes.insert({
				conteudoId: input.conteudoId,
				corpo: input.corpo,
				changelog: input.changelog,
				revisorId: input.revisorId,
			});
			return revisao;
		}),

	listRevisoes: protectedProcedure
		.input(z.object({ conteudoId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// Verify conteudo belongs to team first
			const conteudo = await db.conteudos
				.where({ id: input.conteudoId, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "NOT_FOUND" });

			const revisoes = await db.conteudoRevisoes
				.where({ conteudoId: input.conteudoId })
				.select("*")
				.order({ createdAt: "DESC" });
			return revisoes;
		}),

	getRevisaoById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const revisao = await db.conteudoRevisoes
				.where({ id: input.id })
				.select("*")
				.take();
			if (!revisao) throw new TRPCError({ code: "NOT_FOUND" });

			// Verify the parent conteudo belongs to team
			const conteudo = await db.conteudos
				.where({ id: revisao.conteudoId, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "FORBIDDEN" });

			return revisao;
		}),

	updateRevisao: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: conteudoRevisaoUpdateInputZod,
			})
		)
		.mutation(async ({ ctx, input }) => {
			// Verify revisao exists and belongs to team
			const revisao = await db.conteudoRevisoes
				.where({ id: input.id })
				.select("*")
				.take();
			if (!revisao) throw new TRPCError({ code: "NOT_FOUND" });

			const conteudo = await db.conteudos
				.where({ id: revisao.conteudoId, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "FORBIDDEN" });

			const updated = await db.conteudoRevisoes
				.where({ id: input.id })
				.update(input.data);
			return updated;
		}),

	deleteRevisao: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Verify revisao belongs to team via conteudo
			const revisao = await db.conteudoRevisoes
				.where({ id: input.id })
				.select("*")
				.take();
			if (!revisao) throw new TRPCError({ code: "NOT_FOUND" });

			const conteudo = await db.conteudos
				.where({ id: revisao.conteudoId, teamId: ctx.user.teamId })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "FORBIDDEN" });

			const deleted = await db.conteudoRevisoes
				.where({ id: input.id })
				.delete();
			return { success: true };
		}),
});
