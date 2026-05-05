import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { trpcRouter, createCallerFactory } from '@backend/trpc';
import { authContext, unauthContext } from '@backend/test-utils/mock-context';
import {
	editorialCreateInputZod,
	editorialUpdateInputZod,
	editorialGetByIdZod,
	listEditorialFilterZod,
} from '@repo/zod-schemas/editorial.zod';

/* -------------------------------------------------------------------------- */
/*  Mock OrchidORM table builder                                               */
/* -------------------------------------------------------------------------- */

interface MockTableState {
	listResult: unknown[];
	takeResult: unknown;
	updateResult: unknown;
	deleteResult: unknown;
	lastCreateInput: unknown;
}

function createMockTable() {
	const state: MockTableState = {
		listResult: [],
		takeResult: undefined,
		updateResult: undefined,
		deleteResult: undefined,
		lastCreateInput: undefined,
	};

	const makeQuery = () => {
		const self = {
			select: vi.fn(() => self),
			where: vi.fn(() => self),
			order: vi.fn(() => self),
			limit: vi.fn(() => self),
			whereSql: vi.fn(() => self),
			take: vi.fn(async () => state.takeResult),
			update: vi.fn(async (_data: unknown) => state.updateResult),
			delete: vi.fn(async () => state.deleteResult),
			then: vi.fn((resolve: (value: unknown) => unknown) =>
				Promise.resolve(resolve(state.listResult)),
			),
		};
		return self;
	};

	const table = {
		select: vi.fn(() => makeQuery()),
		where: vi.fn(() => makeQuery()),
		create: vi.fn(async (data: unknown) => {
			state.lastCreateInput = data;
			return {
				...(data as Record<string, unknown>),
				editorialId: 'mock-editorial-id',
				createdAt: new Date('2026-01-01'),
				updatedAt: new Date('2026-01-01'),
			};
		}),
		// exposed helpers for test control
		_setListResult: (r: unknown[]) => {
			state.listResult = r;
		},
		_setTakeResult: (r: unknown) => {
			state.takeResult = r;
		},
		_setUpdateResult: (r: unknown) => {
			state.updateResult = r;
		},
		_setDeleteResult: (r: unknown) => {
			state.deleteResult = r;
		},
		_getLastCreateInput: () => state.lastCreateInput,
	};

	return table;
}

/* -------------------------------------------------------------------------- */
/*  Router under test                                                          */
/* -------------------------------------------------------------------------- */

describe('createCrudRouter factory', () => {
	const mockTable = createMockTable();

	const testRouter = trpcRouter({
		...createCrudRouter({
			table: mockTable,
			schemas: {
				list: listEditorialFilterZod,
				create: editorialCreateInputZod,
				update: editorialUpdateInputZod,
				delete: editorialGetByIdZod,
				getById: editorialGetByIdZod,
			},
			idColumn: 'editorialId',
			teamColumn: 'teamId',
			maxListLimit: 500,
			defaultOrder: { dataPublicacao: 'ASC' },
			hooks: {
				buildListQuery: (query: any, input: any) => {
					if (input.dataInicio) {
						query = query.whereSql`\"dataPublicacao\" >= ${input.dataInicio}::date`;
					}
					if (input.dataFim) {
						query = query.whereSql`\"dataPublicacao\" <= ${input.dataFim}::date`;
					}
					return query;
				},
				transformCreateInput: (input: any) => ({ ...input, transformed: true }),
			},
		}),
	});

	const createCaller = createCallerFactory(testRouter);

	const TEAM_ID = 'team-test-001';
	const authCtxWithTeam = authContext({ teamId: TEAM_ID });

	const VALID_EDITORIAL_INPUT = {
		titulo: 'Test Post',
		canal: 'Instagram' as const,
		formato: 'Post' as const,
		status: 'Ideia' as const,
		dataPublicacao: '2026-04-01',
	};

	const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

	beforeEach(() => {
		vi.clearAllMocks();
		mockTable._setListResult([]);
		mockTable._setTakeResult(undefined);
		mockTable._setUpdateResult(undefined);
		mockTable._setDeleteResult(undefined);
	});

	/* ------------------------------------------------------------------------ */
	// 1. Auth guard
	/* ------------------------------------------------------------------------ */
	describe('auth guard', () => {
		const caller = createCaller(unauthContext());

		it('list rejects unauthenticated', async () => {
			await expect(caller.list({})).rejects.toMatchObject({
				code: 'UNAUTHORIZED',
			});
		});

		it('getById rejects unauthenticated', async () => {
			await expect(
				caller.getById({ editorialId: FAKE_UUID }),
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
		});

		it('create rejects unauthenticated', async () => {
			await expect(caller.create(VALID_EDITORIAL_INPUT)).rejects.toMatchObject({
				code: 'UNAUTHORIZED',
			});
		});

		it('update rejects unauthenticated', async () => {
			await expect(
				caller.update({ editorialId: FAKE_UUID }),
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
		});

		it('delete rejects unauthenticated', async () => {
			await expect(
				caller.delete({ editorialId: FAKE_UUID }),
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
		});
	});

	/* ------------------------------------------------------------------------ */
	// 2. list
	/* ------------------------------------------------------------------------ */
	describe('list', () => {
		const caller = createCaller(authCtxWithTeam);

		it('returns items from the mocked table', async () => {
			mockTable._setListResult([
				{ editorialId: '1', titulo: 'A', teamId: TEAM_ID },
				{ editorialId: '2', titulo: 'B', teamId: TEAM_ID },
			]);

			const result = await caller.list({});
			expect(result).toHaveLength(2);
			expect(mockTable.select).toHaveBeenCalledWith('*');
		});

		it('applies status filter when provided', async () => {
			mockTable._setListResult([]);
			await caller.list({ status: 'Ideia' });

			// The factory calls query.where({ status: 'Ideia' })
			const queryAfterSelect = mockTable.select.mock.results[0].value;
			expect(queryAfterSelect.where).toHaveBeenCalledWith({ status: 'Ideia' });
		});

		it('applies team filter automatically', async () => {
			mockTable._setListResult([]);
			await caller.list({});

			const queryAfterSelect = mockTable.select.mock.results[0].value;
			expect(queryAfterSelect.where).toHaveBeenCalledWith({ teamId: TEAM_ID });
		});

		it('applies buildListQuery hook for dataInicio / dataFim', async () => {
			mockTable._setListResult([]);
			await caller.list({ dataInicio: '2026-04-01', dataFim: '2026-04-30' });

			const queryAfterSelect = mockTable.select.mock.results[0].value;
			expect(queryAfterSelect.whereSql).toHaveBeenCalledTimes(2);
		});

		it('applies defaultOrder and maxListLimit', async () => {
			mockTable._setListResult([]);
			await caller.list({});

			const queryAfterSelect = mockTable.select.mock.results[0].value;
			expect(queryAfterSelect.order).toHaveBeenCalledWith({ dataPublicacao: 'ASC' });
			expect(queryAfterSelect.limit).toHaveBeenCalledWith(500);
		});
	});

	/* ------------------------------------------------------------------------ */
	// 3. getById
	/* ------------------------------------------------------------------------ */
	describe('getById', () => {
		const caller = createCaller(authCtxWithTeam);

		it('returns the item when found', async () => {
			mockTable._setTakeResult({ editorialId: FAKE_UUID, titulo: 'Found', teamId: TEAM_ID });

			const result = await caller.getById({ editorialId: FAKE_UUID });
			expect(result).toMatchObject({ editorialId: FAKE_UUID, titulo: 'Found' });
			expect(mockTable.where).toHaveBeenCalledWith({ editorialId: FAKE_UUID });
		});

		it('throws NOT_FOUND when item does not exist', async () => {
			mockTable._setTakeResult(undefined);

			await expect(caller.getById({ editorialId: FAKE_UUID })).rejects.toMatchObject({
				code: 'NOT_FOUND',
			});
		});

		it('applies team filter', async () => {
			mockTable._setTakeResult({ editorialId: FAKE_UUID, teamId: TEAM_ID });
			await caller.getById({ editorialId: FAKE_UUID });

			const queryAfterFirstWhere = mockTable.where.mock.results[0].value;
			expect(queryAfterFirstWhere.where).toHaveBeenCalledWith({ teamId: TEAM_ID });
		});
	});

	/* ------------------------------------------------------------------------ */
	// 4. create
	/* ------------------------------------------------------------------------ */
	describe('create', () => {
		const caller = createCaller(authCtxWithTeam);

		it('creates an item with injected teamId', async () => {
			const result = await caller.create(VALID_EDITORIAL_INPUT);
			expect(result).toMatchObject({
				...VALID_EDITORIAL_INPUT,
				editorialId: 'mock-editorial-id',
				teamId: TEAM_ID,
				transformed: true,
			});
		});

		it('calls transformCreateInput hook', async () => {
			await caller.create(VALID_EDITORIAL_INPUT);
			const lastInput = mockTable._getLastCreateInput();
			expect(lastInput).toMatchObject({ transformed: true });
		});
	});

	/* ------------------------------------------------------------------------ */
	// 5. update
	/* ------------------------------------------------------------------------ */
	describe('update', () => {
		const caller = createCaller(authCtxWithTeam);

		it('updates an item when found', async () => {
			mockTable._setUpdateResult({ editorialId: FAKE_UUID, titulo: 'Updated' });

			const result = await caller.update({
				editorialId: FAKE_UUID,
				titulo: 'Updated',
				canal: 'Instagram',
				formato: 'Post',
				status: 'Ideia',
				dataPublicacao: '2026-04-01',
			});
			expect(result).toMatchObject({ editorialId: FAKE_UUID, titulo: 'Updated' });
		});

		it('throws NOT_FOUND when item does not exist', async () => {
			mockTable._setUpdateResult(undefined);

			await expect(
				caller.update({
					editorialId: FAKE_UUID,
					titulo: 'Updated',
					canal: 'Instagram',
					formato: 'Post',
					status: 'Ideia',
					dataPublicacao: '2026-04-01',
				}),
			).rejects.toMatchObject({ code: 'NOT_FOUND' });
		});

		it('strips idColumn from update payload', async () => {
			mockTable._setUpdateResult({ editorialId: FAKE_UUID });
			await caller.update({
				editorialId: FAKE_UUID,
				titulo: 'Updated',
				canal: 'Instagram',
				formato: 'Post',
				status: 'Ideia',
				dataPublicacao: '2026-04-01',
			});

			const updateCall = mockTable.where.mock.results[0].value.update;
			const payload = updateCall.mock.calls[0][0];
			expect(payload).not.toHaveProperty('editorialId');
		});

		it('applies team filter on where clause', async () => {
			mockTable._setUpdateResult({ editorialId: FAKE_UUID });
			await caller.update({
				editorialId: FAKE_UUID,
				titulo: 'Updated',
				canal: 'Instagram',
				formato: 'Post',
				status: 'Ideia',
				dataPublicacao: '2026-04-01',
			});

			expect(mockTable.where).toHaveBeenCalledWith({
				editorialId: FAKE_UUID,
				teamId: TEAM_ID,
			});
		});
	});

	/* ------------------------------------------------------------------------ */
	// 6. delete
	/* ------------------------------------------------------------------------ */
	describe('delete', () => {
		const caller = createCaller(authCtxWithTeam);

		it('deletes an item when found', async () => {
			mockTable._setDeleteResult({ editorialId: FAKE_UUID });

			const result = await caller.delete({ editorialId: FAKE_UUID });
			expect(result).toEqual({ success: true });
		});

		it('throws NOT_FOUND when item does not exist', async () => {
			mockTable._setDeleteResult(undefined);

			await expect(caller.delete({ editorialId: FAKE_UUID })).rejects.toMatchObject({
				code: 'NOT_FOUND',
			});
		});

		it('applies team filter on where clause', async () => {
			mockTable._setDeleteResult({ editorialId: FAKE_UUID });
			await caller.delete({ editorialId: FAKE_UUID });

			expect(mockTable.where).toHaveBeenCalledWith({
				editorialId: FAKE_UUID,
				teamId: TEAM_ID,
			});
		});
	});
});
