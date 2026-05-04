import { protectedProcedure } from '@backend/trpc';
import { TRPCError } from '@trpc/server';
import type { ZodTypeAny } from 'zod';
import type { TrpcContext } from '@backend/trpc';

export interface CrudSchemas {
	list: ZodTypeAny;
	create: ZodTypeAny;
	update: ZodTypeAny;
	delete: ZodTypeAny;
	getById: ZodTypeAny;
}

export interface CrudFactoryHooks {
	/** Mutate or replace the list query before execution */
	buildListQuery?: (query: any, input: any, ctx: TrpcContext) => any;
	/** Mutate or replace the getById query before execution */
	buildGetByIdQuery?: (query: any, input: any, ctx: TrpcContext) => any;
	/** Transform input before create */
	transformCreateInput?: (input: any, ctx: TrpcContext) => any;
	/** Hook called before update (e.g. validation, team check) */
	onBeforeUpdate?: (input: any, ctx: TrpcContext) => Promise<void>;
	/** Transform input before update (id already extracted) */
	transformUpdateInput?: (input: any, ctx: TrpcContext) => any;
	/** Hook called before delete (e.g. validation) */
	onBeforeDelete?: (input: any, ctx: TrpcContext) => Promise<void>;
	/** Transform list result before return */
	transformListResult?: (items: any[], input: any, ctx: TrpcContext) => any;
	/** Transform single item before return */
	transformGetByIdResult?: (item: any, ctx: TrpcContext) => any;
}

export interface CrudFactoryConfig {
	/** OrchidORM table instance from db */
	table: any;
	/** Zod schemas for the 5 standard operations */
	schemas: CrudSchemas;
	/** Primary key column name (e.g. 'editorialId', 'reminderId') */
	idColumn: string;
	/** If set, automatically filters list/reads/writes by ctx.user.teamId */
	teamColumn?: string;
	/** Max rows returned by list (default 1000) */
	maxListLimit?: number;
	/** Default ORDER BY clause */
	defaultOrder?: Record<string, 'ASC' | 'DESC'>;
	/** Custom hooks for non-standard behaviour */
	hooks?: CrudFactoryHooks;
}

/**
 * Generates the 5 standard CRUD procedures for a tRPC router.
 *
 * Usage in a module router:
 * ```ts
 * export const editorialRouterTrpc = trpcRouter({
 *   ...createCrudRouter({
 *     table: db.editorialItems,
 *     schemas: { list: listEditorialFilterZod, create: editorialCreateInputZod, update: editorialUpdateInputZod, delete: editorialGetByIdZod, getById: editorialGetByIdZod },
 *     idColumn: 'editorialId',
 *     teamColumn: 'teamId',
 *     maxListLimit: 500,
 *     defaultOrder: { dataPublicacao: 'ASC' },
 *     hooks: {
 *       buildListQuery: (query, input) => {
 *         if (input.dataInicio) query = query.whereSql`"dataPublicacao" >= ${input.dataInicio}::date`;
 *         return query;
 *       },
 *     },
 *   }),
 *   moveToProducao: protectedProcedure.input(...).mutation(...),
 * });
 * ```
 */
export function createCrudRouter(config: CrudFactoryConfig) {
	const { table, schemas, idColumn, teamColumn, maxListLimit = 1000, defaultOrder, hooks } = config;

	const applyTeamWhere = (where: Record<string, any>, ctx: TrpcContext) => {
		if (teamColumn && ctx.user?.teamId) {
			where[teamColumn] = ctx.user.teamId;
		}
		return where;
	};

	return {
		list: protectedProcedure.input(schemas.list).query(async ({ ctx, input: _input }) => {
			const input = _input as Record<string, any>;
			let query: any = table.select('*');

			// Apply simple equality filters from input (skip pagination/meta keys)
			const skipKeys = new Set(['limit', 'offset', 'sortBy', 'sortOrder', 'dataInicio', 'dataFim']);
			for (const [key, value] of Object.entries(input)) {
				if (value !== undefined && !skipKeys.has(key)) {
					query = query.where({ [key]: value });
				}
			}

			// Apply team filter (as WHERE, not injected into input)
			if (teamColumn) {
				query = query.where({ [teamColumn]: ctx.user.teamId });
			}

			if (hooks?.buildListQuery) {
				query = hooks.buildListQuery(query, input, ctx);
			}

			if (defaultOrder) {
				query = query.order(defaultOrder);
			}

			query = query.limit(maxListLimit);

			const items = await query;

			if (hooks?.transformListResult) {
				return hooks.transformListResult(items, input, ctx);
			}
			return items;
		}),

		getById: protectedProcedure.input(schemas.getById).query(async ({ ctx, input }) => {
			const idValue = (input as Record<string, any>)[idColumn];
			if (idValue === undefined) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: `${idColumn} is required` });
			}

			let query = table.where({ [idColumn]: idValue });
			if (teamColumn) {
				query = query.where({ [teamColumn]: ctx.user.teamId });
			}

			if (hooks?.buildGetByIdQuery) {
				query = hooks.buildGetByIdQuery(query, input, ctx);
			}

			const item = await query.take();
			if (!item) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
			}

			if (hooks?.transformGetByIdResult) {
				return hooks.transformGetByIdResult(item, ctx);
			}
			return item;
		}),

		create: protectedProcedure.input(schemas.create).mutation(async ({ ctx, input }) => {
			let data: any = input;

			if (teamColumn) {
				data = { ...data, [teamColumn]: ctx.user.teamId };
			}

			if (hooks?.transformCreateInput) {
				data = hooks.transformCreateInput(data, ctx);
			}

			return table.create(data);
		}),

		update: protectedProcedure.input(schemas.update).mutation(async ({ ctx, input }) => {
			const idValue = (input as Record<string, any>)[idColumn];
			if (idValue === undefined) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: `${idColumn} is required` });
			}

			if (hooks?.onBeforeUpdate) {
				await hooks.onBeforeUpdate(input, ctx);
			}

			let data: any = { ...(input as any) };
			delete data[idColumn];

			if (hooks?.transformUpdateInput) {
				data = hooks.transformUpdateInput(data, ctx);
			}

			const where = applyTeamWhere({ [idColumn]: idValue }, ctx);
			const updated = await table.where(where).update(data);
			if (!updated) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
			}
			return updated;
		}),

		delete: protectedProcedure.input(schemas.delete).mutation(async ({ ctx, input }) => {
			const idValue = (input as Record<string, any>)[idColumn];
			if (idValue === undefined) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: `${idColumn} is required` });
			}

			if (hooks?.onBeforeDelete) {
				await hooks.onBeforeDelete(input, ctx);
			}

			const where = applyTeamWhere({ [idColumn]: idValue }, ctx);
			const deleted = await table.where(where).delete();
			if (!deleted) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
			}
			return { success: true };
		}),
	};
}
