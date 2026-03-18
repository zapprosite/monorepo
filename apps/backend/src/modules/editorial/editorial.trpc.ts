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
	listEditorialItems: protectedProcedure
		.input(listEditorialFilterZod)
		.query(async ({ input }) => {
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
			if (!item) throw new Error("Item editorial não encontrado");
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
			return db.editorialItems.find(editorialId).update(data);
		}),

	moveToProducao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			return db.editorialItems.find(editorialId).update({ status: "Em Produção" });
		}),

	moveToRevisao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			return db.editorialItems.find(editorialId).update({ status: "Revisão" });
		}),

	approveItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			return db.editorialItems.find(editorialId).update({ status: "Aprovado" });
		}),

	publishItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			return db.editorialItems.find(editorialId).update({ status: "Publicado" });
		}),

	cancelItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ input: { editorialId } }) => {
			return db.editorialItems.find(editorialId).update({ status: "Cancelado" });
		}),
});
