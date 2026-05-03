import { appTrpcRouter } from '@backend/routers/trpc.router';
import { authContext, unauthContext } from '@backend/test-utils/mock-context';
import { createCallerFactory } from '@backend/trpc';
import { describe, expect, it } from 'vitest';

const createCaller = createCallerFactory(appTrpcRouter);
const FAKE_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe('webhooks — auth guard', () => {
	const caller = createCaller(unauthContext());

	it('create rejeita não autenticado', async () => {
		await expect(
			caller.webhooks.create({
				url: 'https://example.com/webhook',
				eventoTipo: 'maintenance.scheduled',
				ativo: true,
				tentativasMax: 3,
				intervaloRetryMin: 5,
				clienteId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('list rejeita não autenticado', async () => {
		await expect(caller.webhooks.list({ clienteId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('getById rejeita não autenticado', async () => {
		await expect(caller.webhooks.getById({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('update rejeita não autenticado', async () => {
		await expect(
			caller.webhooks.update({ id: FAKE_UUID, data: { ativo: false } }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('delete rejeita não autenticado', async () => {
		await expect(caller.webhooks.delete({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('listDeliveries rejeita não autenticado', async () => {
		await expect(caller.webhooks.listDeliveries({ webhookId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});
});

// ---------------------------------------------------------------------------
// create — team isolation
// ---------------------------------------------------------------------------
describe('webhooks — create team isolation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('create lança FORBIDDEN para cliente de outro team', async () => {
		await expect(
			caller.webhooks.create({
				url: 'https://example.com/webhook',
				eventoTipo: 'maintenance.scheduled',
				ativo: true,
				tentativasMax: 3,
				intervaloRetryMin: 5,
				clienteId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('create lança erro para UUID inválido em clienteId', async () => {
		await expect(
			caller.webhooks.create({
				url: 'https://example.com/webhook',
				eventoTipo: 'maintenance.scheduled',
				ativo: true,
				tentativasMax: 3,
				intervaloRetryMin: 5,
				clienteId: 'not-a-uuid',
			} as any),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// list — team isolation
// ---------------------------------------------------------------------------
describe('webhooks — list team isolation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('list lança FORBIDDEN para cliente de outro team', async () => {
		await expect(caller.webhooks.list({ clienteId: FAKE_UUID })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
	});

	it('list lança erro para UUID inválido em clienteId', async () => {
		await expect(caller.webhooks.list({ clienteId: 'not-a-uuid' })).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getById — NOT_FOUND / team isolation
// ---------------------------------------------------------------------------
describe('webhooks — getById validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('getById lança NOT_FOUND para webhook inexistente', async () => {
		await expect(caller.webhooks.getById({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('getById lança FORBIDDEN para webhook de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(callerOther.webhooks.getById({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
	});

	it('getById lança erro para UUID inválido', async () => {
		await expect(caller.webhooks.getById({ id: 'not-a-uuid' })).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// update — NOT_FOUND / team isolation
// ---------------------------------------------------------------------------
describe('webhooks — update validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('update lança NOT_FOUND para webhook inexistente', async () => {
		await expect(
			caller.webhooks.update({ id: FAKE_UUID, data: { ativo: false } }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('update lança FORBIDDEN para webhook de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(
			callerOther.webhooks.update({ id: FAKE_UUID, data: { ativo: false } }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});

// ---------------------------------------------------------------------------
// delete — NOT_FOUND / team isolation
// ---------------------------------------------------------------------------
describe('webhooks — delete validation', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('delete lança NOT_FOUND para webhook inexistente', async () => {
		await expect(caller.webhooks.delete({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('delete lança FORBIDDEN para webhook de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(callerOther.webhooks.delete({ id: FAKE_UUID })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
	});
});

// ---------------------------------------------------------------------------
// listDeliveries — IDOR protection
// ---------------------------------------------------------------------------
describe('webhooks — listDeliveries IDOR protection', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('listDeliveries lança NOT_FOUND para webhook inexistente', async () => {
		await expect(caller.webhooks.listDeliveries({ webhookId: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('listDeliveries lança FORBIDDEN para webhook de outro team', async () => {
		const callerOther = createCaller(authContext({ teamId: 'team-other' }));
		await expect(
			callerOther.webhooks.listDeliveries({ webhookId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
