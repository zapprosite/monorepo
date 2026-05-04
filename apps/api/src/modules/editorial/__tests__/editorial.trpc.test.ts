import { appTrpcRouter } from '@backend/routers/trpc.router';
import { authContext, unauthContext } from '@backend/test-utils/mock-context';
import { createCallerFactory } from '@backend/trpc';
import { describe, expect, it } from 'vitest';

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = '00000000-0000-0000-0000-000000000002';
const INVALID_UUID = 'not-a-uuid';

const VALID_EDITORIAL_INPUT = {
	titulo: 'Post Instagram Refrimix',
	canal: 'Instagram' as const,
	formato: 'Post' as const,
	status: 'Ideia' as const,
	dataPublicacao: '2026-04-01',
};

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe('editorial — auth guard (UNAUTHORIZED)', () => {
	const caller = createCaller(unauthContext());

	it('list rejeita não autenticado', async () => {
		await expect(caller.editorial.list({})).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('getById rejeita não autenticado', async () => {
		await expect(
			caller.editorial.getById({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('create rejeita não autenticado', async () => {
		await expect(caller.editorial.create(VALID_EDITORIAL_INPUT)).rejects.toMatchObject(
			{ code: 'UNAUTHORIZED' },
		);
	});

	it('update rejeita não autenticado', async () => {
		await expect(
			caller.editorial.update({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('moveToProducao rejeita não autenticado', async () => {
		await expect(caller.editorial.moveToProducao({ editorialId: FAKE_UUID })).rejects.toMatchObject(
			{ code: 'UNAUTHORIZED' },
		);
	});

	it('moveToRevisao rejeita não autenticado', async () => {
		await expect(caller.editorial.moveToRevisao({ editorialId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('approveItem rejeita não autenticado', async () => {
		await expect(caller.editorial.approveItem({ editorialId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('publishItem rejeita não autenticado', async () => {
		await expect(caller.editorial.publishItem({ editorialId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('cancelItem rejeita não autenticado', async () => {
		await expect(caller.editorial.cancelItem({ editorialId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe('editorial — validação de input (Zod)', () => {
	const caller = createCaller(authContext());

	it('getById rejeita editorialId inválido', async () => {
		await expect(
			caller.editorial.getById({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it('create rejeita sem titulo', async () => {
		await expect(
			// @ts-expect-error — titulo ausente proposital
			caller.editorial.create({
				canal: 'Instagram',
				formato: 'Post',
				status: 'Ideia' as const,
				dataPublicacao: '2026-04-01',
			}),
		).rejects.toThrow();
	});

	it('create rejeita canal inválido', async () => {
		await expect(
			caller.editorial.create({
				titulo: 'Título válido',
				canal: 'TikTokFake' as unknown as 'Instagram',
				formato: 'Post',
				status: 'Ideia' as const,
				dataPublicacao: '2026-04-01',
			}),
		).rejects.toThrow();
	});

	it('create rejeita formato inválido', async () => {
		await expect(
			caller.editorial.create({
				titulo: 'Título válido',
				canal: 'Instagram',
				formato: 'FormatoInexistente' as unknown as 'Post',
				status: 'Ideia' as const,
				dataPublicacao: '2026-04-01',
			}),
		).rejects.toThrow();
	});

	it('create rejeita dataPublicacao com formato inválido', async () => {
		await expect(
			caller.editorial.create({
				titulo: 'Título válido',
				canal: 'Instagram',
				formato: 'Post',
				status: 'Ideia' as const,
				dataPublicacao: '01-04-2026', // formato errado
			}),
		).rejects.toThrow();
	});

	it('update rejeita editorialId inválido', async () => {
		await expect(
			caller.editorial.update({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it('moveToProducao rejeita editorialId inválido', async () => {
		await expect(caller.editorial.moveToProducao({ editorialId: INVALID_UUID })).rejects.toThrow();
	});

	it('approveItem rejeita editorialId inválido', async () => {
		await expect(caller.editorial.approveItem({ editorialId: INVALID_UUID })).rejects.toThrow();
	});
});
