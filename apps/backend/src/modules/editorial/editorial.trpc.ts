import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	editorialCreateInputZod,
	editorialGetByIdZod,
	editorialUpdateInputZod,
	listEditorialFilterZod,
} from "@connected-repo/zod-schemas/editorial.zod";

const EDITORIAL_MAX_LIMIT = 500;

export const editorialRouterTrpc = trpcRouter({
	listEditorialItems: protectedProcedure.input(listEditorialFilterZod).query(async ({ input }) => {
		let query = db.editorialItems.select("*");

		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.canal) {
			query = query.where({ canal: input.canal });
		}
		if (input.formato) {
			query = query.where({ formato: input.formato });
		}
		if (input.dataInicio) {
			const inicio = input.dataInicio;
			query = query.whereSql`"dataPublicacao" >= ${inicio}::date`;
		}
		if (input.dataFim) {
			const fim = input.dataFim;
			query = query.whereSql`"dataPublicacao" <= ${fim}::date`;
		}

		return query.order({ dataPublicacao: "ASC" }).limit(EDITORIAL_MAX_LIMIT);
	}),

	getEditorialDetail: protectedProcedure
		.input(editorialGetByIdZod)
		.query(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			return item;
		}),

	createEditorialItem: protectedProcedure
		.input(editorialCreateInputZod)
		.mutation(async ({ input }) => {
			return db.editorialItems.create(input);
		}),

	updateEditorialItem: protectedProcedure
		.input(editorialUpdateInputZod)
		.mutation(async ({ input: { editorialId, ...data } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			return db.editorialItems.where({ editorialId }).update(data);
		}),

	moveToProducao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			if (item.status !== "Ideia") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível mover para 'Em Produção' a partir de 'Ideia'" });
			}
			return db.editorialItems.where({ editorialId }).update({ status: "Em Produção" });
		}),

	moveToRevisao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			if (item.status !== "Em Produção") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível mover para 'Revisão' a partir de 'Em Produção'" });
			}
			return db.editorialItems.where({ editorialId }).update({ status: "Revisão" });
		}),

	approveItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			if (item.status !== "Revisão") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível aprovar a partir de 'Revisão'" });
			}
			return db.editorialItems.where({ editorialId }).update({ status: "Aprovado" });
		}),

	publishItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			if (item.status !== "Aprovado") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível publicar a partir de 'Aprovado'" });
			}
			return db.editorialItems.where({ editorialId }).update({ status: "Publicado" });
		}),

	cancelItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item editorial não encontrado" });
			if (item.status === "Publicado") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível cancelar um item já publicado" });
			}
			return db.editorialItems.where({ editorialId }).update({ status: "Cancelado" });
		}),
});
