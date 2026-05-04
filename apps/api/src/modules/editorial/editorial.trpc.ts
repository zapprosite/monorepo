import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	editorialCreateInputZod,
	editorialGetByIdZod,
	editorialUpdateInputZod,
	listEditorialFilterZod,
} from '@repo/zod-schemas/editorial.zod';
import { TRPCError } from '@trpc/server';

const EDITORIAL_MAX_LIMIT = 500;

export const editorialRouterTrpc = trpcRouter({
	...createCrudRouter({
		table: db.editorialItems,
		schemas: {
			list: listEditorialFilterZod,
			create: editorialCreateInputZod,
			update: editorialUpdateInputZod,
			delete: editorialGetByIdZod,
			getById: editorialGetByIdZod,
		},
		idColumn: 'editorialId',
		teamColumn: 'teamId',
		maxListLimit: EDITORIAL_MAX_LIMIT,
		defaultOrder: { dataPublicacao: 'ASC' },
		hooks: {
			buildListQuery: (query, input: any) => {
				if (input.dataInicio) {
					query = query.whereSql`"dataPublicacao" >= ${input.dataInicio}::date`;
				}
				if (input.dataFim) {
					query = query.whereSql`"dataPublicacao" <= ${input.dataFim}::date`;
				}
				return query;
			},
		},
	}),

	moveToProducao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ ctx, input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.status !== 'Ideia') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível mover para 'Em Produção' a partir de 'Ideia'",
				});
			}
			return db.editorialItems.where({ editorialId }).update({ status: 'Em Produção' });
		}),

	moveToRevisao: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ ctx, input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.status !== 'Em Produção') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível mover para 'Revisão' a partir de 'Em Produção'",
				});
			}
			return db.editorialItems.where({ editorialId }).update({ status: 'Revisão' });
		}),

	approveItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ ctx, input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.status !== 'Revisão') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível aprovar a partir de 'Revisão'",
				});
			}
			return db.editorialItems.where({ editorialId }).update({ status: 'Aprovado' });
		}),

	publishItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ ctx, input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.status !== 'Aprovado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível publicar a partir de 'Aprovado'",
				});
			}
			return db.editorialItems.where({ editorialId }).update({ status: 'Publicado' });
		}),

	cancelItem: protectedProcedure
		.input(editorialGetByIdZod)
		.mutation(async ({ ctx, input: { editorialId } }) => {
			const item = await db.editorialItems.findOptional(editorialId);
			if (!item)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Item editorial não encontrado' });
			if (item.status === 'Publicado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Não é possível cancelar um item já publicado',
				});
			}
			return db.editorialItems.where({ editorialId }).update({ status: 'Cancelado' });
		}),
});
