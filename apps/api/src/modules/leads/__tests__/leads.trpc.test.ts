import { appTrpcRouter } from '@backend/routers/trpc.router';
import { authContext, unauthContext } from '@backend/test-utils/mock-context';
import { createCallerFactory } from '@backend/trpc';
import { describe, expect, it } from 'vitest';

const createCaller = createCallerFactory(appTrpcRouter);

// Valid UUIDs (not real, but structurally valid)
const FAKE_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const _FAKE_UUID_2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const _FAKE_UUID_3 = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe('leads — auth guard (UNAUTHORIZED)', () => {
	const caller = createCaller(unauthContext());

	it('listLeads rejeita não autenticado', async () => {
		await expect(caller.leads.listLeads({})).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('getLeadDetail rejeita não autenticado', async () => {
		await expect(caller.leads.getLeadDetail({ leadId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});

	it('createLead rejeita não autenticado', async () => {
		await expect(
			caller.leads.createLead({
				nome: 'Test Lead',
				origem: 'Site',
				status: 'Novo',
			}),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('updateLead rejeita não autenticado', async () => {
		await expect(
			caller.leads.updateLead({ leadId: FAKE_UUID, nome: 'Updated' }),
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('convertLeadToClient rejeita não autenticado', async () => {
		await expect(caller.leads.convertLeadToClient({ leadId: FAKE_UUID })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});
});

// ---------------------------------------------------------------------------
// listLeads — filtros
// ---------------------------------------------------------------------------
describe('leads — listLeads filters', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('listLeads sem filtros retorna array', async () => {
		const result = await caller.leads.listLeads({});
		expect(Array.isArray(result)).toBe(true);
	});

	it('listLeads com filtro status', async () => {
		const result = await caller.leads.listLeads({ status: 'Novo' });
		expect(Array.isArray(result)).toBe(true);
	});

	it('listLeads com filtro origem', async () => {
		const result = await caller.leads.listLeads({ origem: 'Indicação' });
		expect(Array.isArray(result)).toBe(true);
	});

	it('listLeads com filtro responsavelId (UUID válido)', async () => {
		const result = await caller.leads.listLeads({ responsavelId: FAKE_UUID });
		expect(Array.isArray(result)).toBe(true);
	});

	it('listLeads com search term', async () => {
		const result = await caller.leads.listLeads({ search: 'João' });
		expect(Array.isArray(result)).toBe(true);
	});

	it('listLeads com múltiplos filtros', async () => {
		const result = await caller.leads.listLeads({
			status: 'Qualificado',
			origem: 'Indicação',
			search: 'Silva',
		});
		expect(Array.isArray(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getLeadDetail — NOT_FOUND e validação UUID
// ---------------------------------------------------------------------------
describe('leads — getLeadDetail', () => {
	const caller = createCaller(authContext({ teamId: 'team-01' }));

	it('getLeadDetail lança NOT_FOUND para lead inexistente', async () => {
		await expect(caller.leads.getLeadDetail({ leadId: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('getLeadDetail rejeita UUID inválido (BAD_REQUEST)', async () => {
		await expect(caller.leads.getLeadDetail({ leadId: 'not-a-uuid' })).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		});
	});
});

// ---------------------------------------------------------------------------
// createLead — criação (origem é mandatory, status é mandatory)
// ---------------------------------------------------------------------------
describe('leads — createLead', () => {
	const caller = createCaller(authContext({ teamId: 'team-create' }));

	it('createLead cria lead com campos obrigatórios', async () => {
		const result = await caller.leads.createLead({
			nome: 'Lead Novo',
			origem: 'Site',
			status: 'Novo',
		});
		expect(result).toMatchObject({
			nome: 'Lead Novo',
			origem: 'Site',
			status: 'Novo',
		});
		expect(result.leadId).toBeDefined();
		expect(result.teamId).toBe('team-create');
	});

	it('createLead com origem Indicação', async () => {
		const result = await caller.leads.createLead({
			nome: 'Lead Indicação',
			origem: 'Indicação',
			status: 'Novo',
		});
		expect(result).toMatchObject({ origem: 'Indicação' });
	});

	it('createLead rejeita status inválido', async () => {
		await expect(
			caller.leads.createLead({
				nome: 'Lead Inválido',
				origem: 'Site',
				status: 'InvalidStatus',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('createLead rejeita origem inválida', async () => {
		await expect(
			caller.leads.createLead({
				nome: 'Lead Inválido',
				origem: 'InvalidOrigem',
				status: 'Novo',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});
});

// ---------------------------------------------------------------------------
// updateLead — NOT_FOUND
// ---------------------------------------------------------------------------
describe('leads — updateLead NOT_FOUND', () => {
	const caller = createCaller(authContext({ teamId: 'team-update' }));

	it('updateLead lança NOT_FOUND para lead inexistente', async () => {
		await expect(
			caller.leads.updateLead({ leadId: FAKE_UUID, nome: 'Nome Atualizado' }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('updateLead rejeita UUID inválido', async () => {
		await expect(
			caller.leads.updateLead({ leadId: 'bad-uuid', nome: 'Test' }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});
});

// ---------------------------------------------------------------------------
// convertLeadToClient — NOT_FOUND
// ---------------------------------------------------------------------------
describe('leads — convertLeadToClient', () => {
	const caller = createCaller(authContext({ teamId: 'team-convert' }));

	it('convertLeadToClient lança NOT_FOUND para lead inexistente', async () => {
		await expect(caller.leads.convertLeadToClient({ leadId: FAKE_UUID })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});
});
