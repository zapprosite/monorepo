import { appTrpcRouter } from '@backend/routers/trpc.router';
import { authContext, unauthContext } from '@backend/test-utils/mock-context';
import { createCallerFactory } from '@backend/trpc';
import { describe, expect, it } from 'vitest';

const createCaller = createCallerFactory(appTrpcRouter);
const FAKE_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe('schedule — auth guard', () => {
	const caller = createCaller(unauthContext());

	it('listSchedules rejeita não autenticado', async () => {
		await expect(caller.schedule.listSchedules({})).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('getScheduleDetail rejeita não autenticado', async () => {
		await expect(
			caller.schedule.getScheduleDetail({ scheduleId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('createSchedule rejeita não autenticado', async () => {
		await expect(
			caller.schedule.createSchedule({
				clienteId: FAKE_UUID,
				dataHora: '2026-06-01T10:00:00Z',
				tipo: 'Visita Técnica',
				status: 'Agendado',
			}),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('updateSchedule rejeita não autenticado', async () => {
		await expect(caller.schedule.updateSchedule({ scheduleId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('deleteSchedule rejeita não autenticado', async () => {
		await expect(caller.schedule.deleteSchedule({ scheduleId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});
});

// ---------------------------------------------------------------------------
// listSchedules — filtros
// ---------------------------------------------------------------------------
describe('schedule — listSchedules filters', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('listSchedules sem filtros retorna array', async () => {
		const result = await caller.schedule.listSchedules({});
		expect(result).toBeInstanceOf(Array);
	});

	it('listSchedules com filtro clienteId retorna array', async () => {
		const result = await caller.schedule.listSchedules({ clienteId: FAKE_UUID });
		expect(result).toBeInstanceOf(Array);
	});

	it('listSchedules com filtro tecnicoId retorna array', async () => {
		const result = await caller.schedule.listSchedules({ tecnicoId: FAKE_UUID });
		expect(result).toBeInstanceOf(Array);
	});

	it('listSchedules com filtro status retorna array', async () => {
		const result = await caller.schedule.listSchedules({ status: 'Agendado' });
		expect(result).toBeInstanceOf(Array);
	});

	it('listSchedules com filtro tipo retorna array', async () => {
		const result = await caller.schedule.listSchedules({ tipo: 'Visita Técnica' });
		expect(result).toBeInstanceOf(Array);
	});
});

// ---------------------------------------------------------------------------
// getScheduleDetail — NOT_FOUND / FORBIDDEN
// ---------------------------------------------------------------------------
describe('schedule — getScheduleDetail validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('getScheduleDetail lança NOT_FOUND para schedule inexistente', async () => {
		await expect(
			caller.schedule.getScheduleDetail({ scheduleId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('getScheduleDetail lança FORBIDDEN para schedule de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(
			callerOther.schedule.getScheduleDetail({ scheduleId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('getScheduleDetail lança erro para UUID inválido', async () => {
		await expect(caller.schedule.getScheduleDetail({ scheduleId: 'not-a-uuid' })).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSchedule — NOT_FOUND / FORBIDDEN
// ---------------------------------------------------------------------------
describe('schedule — createSchedule validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('createSchedule lança NOT_FOUND para cliente inexistente', async () => {
		await expect(
			caller.schedule.createSchedule({
				clienteId: FAKE_UUID,
				dataHora: '2026-06-01T10:00:00Z',
				tipo: 'Visita Técnica',
				status: 'Agendado',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('createSchedule lança FORBIDDEN para tecnico de outro team', async () => {
		await expect(
			caller.schedule.createSchedule({
				clienteId: FAKE_UUID,
				dataHora: '2026-06-01T10:00:00Z',
				tipo: 'Visita Técnica',
				status: 'Agendado',
				tecnicoId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('createSchedule lança erro para UUID inválido em clienteId', async () => {
		await expect(
			caller.schedule.createSchedule({
				clienteId: 'not-a-uuid',
				dataHora: '2026-06-01T10:00:00Z',
				tipo: 'Visita Técnica',
				status: 'Agendado',
			}),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// updateSchedule — NOT_FOUND / FORBIDDEN
// ---------------------------------------------------------------------------
describe('schedule — updateSchedule validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('updateSchedule lança NOT_FOUND para schedule inexistente', async () => {
		await expect(caller.schedule.updateSchedule({ scheduleId: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('updateSchedule lança FORBIDDEN para schedule de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(
			callerOther.schedule.updateSchedule({ scheduleId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});

// ---------------------------------------------------------------------------
// deleteSchedule — NOT_FOUND / FORBIDDEN
// ---------------------------------------------------------------------------
describe('schedule — deleteSchedule validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('deleteSchedule lança NOT_FOUND para schedule inexistente', async () => {
		await expect(caller.schedule.deleteSchedule({ scheduleId: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('deleteSchedule lança FORBIDDEN para schedule de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(
			callerOther.schedule.deleteSchedule({ scheduleId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
