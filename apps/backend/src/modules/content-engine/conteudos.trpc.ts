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
		.query(async ({ input }) => {
			const conteudos = await db.conteudos
				.where({ clienteId: input.clienteId })
				.select("*")
				.order({ createdAt: "DESC" });
			return conteudos;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const conteudo = await db.conteudos
				.where({ id: input.id })
				.select("*")
				.take();
			if (!conteudo) throw new TRPCError({ code: "NOT_FOUND" });
			return conteudo;
		}),

	getBySlug: protectedProcedure
		.input(conteudoGetBySlugZod)
		.query(async ({ input }) => {
			const conteudo = await db.conteudos
				.where({
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
		.mutation(async ({ input }) => {
			const updated = await db.conteudos
				.where({ id: input.id })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const deleted = await db.conteudos
				.where({ id: input.id })
				.delete();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),

	// Conteúdo Revisões
	createRevisao: protectedProcedure
		.input(conteudoRevisaoCreateInputZod)
		.mutation(async ({ input }) => {
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
		.query(async ({ input }) => {
			const revisoes = await db.conteudoRevisoes
				.where({ conteudoId: input.conteudoId })
				.select("*")
				.order({ createdAt: "DESC" });
			return revisoes;
		}),

	getRevisaoById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const revisao = await db.conteudoRevisoes
				.where({ id: input.id })
				.select("*")
				.take();
			if (!revisao) throw new TRPCError({ code: "NOT_FOUND" });
			return revisao;
		}),

	updateRevisao: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: conteudoRevisaoUpdateInputZod,
			})
		)
		.mutation(async ({ input }) => {
			const updated = await db.conteudoRevisoes
				.where({ id: input.id })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	deleteRevisao: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const deleted = await db.conteudoRevisoes
				.where({ id: input.id })
				.delete();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),
});
