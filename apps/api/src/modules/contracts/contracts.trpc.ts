import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	contractCreateInputZod,
	contractGetByIdZod,
	contractUpdateInputZod,
	listContractFilterZod,
} from '@repo/zod-schemas/contract.zod';
import { TRPCError } from '@trpc/server';
import z from 'zod';

const CONTRACTS_MAX_LIMIT = 500;

async function assertContractTeamAccess(contractId: string, teamId: string | null | undefined) {
	const contract = await db.contracts.findOptional(contractId);
	if (!contract) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
	const client = await db.clients.findOptional(contract.clienteId);
	if (!client || client.teamId !== teamId)
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
	return contract;
}

const contractsCrud = createCrudRouter({
	table: db.contracts,
	schemas: {
		list: listContractFilterZod,
		create: contractCreateInputZod,
		update: contractUpdateInputZod,
		delete: contractGetByIdZod,
		getById: contractGetByIdZod,
	},
	idColumn: 'contractId',
	maxListLimit: CONTRACTS_MAX_LIMIT,
	defaultOrder: { dataInicio: 'DESC' },
	hooks: {
		buildListQuery: (query: any, input: any, ctx: any) => {
			query = query
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'contracts.clienteId', 'clients.clientId')
				.where('clients.teamId', ctx.user.teamId);

			if (input.clienteId) query = query.where({ 'contracts.clienteId': input.clienteId });
			if (input.status) query = query.where({ 'contracts.status': input.status });
			if (input.tipo) query = query.where({ 'contracts.tipo': input.tipo });
			if (input.dataInicio) {
				query = query.whereSql`"dataInicio" >= ${input.dataInicio}::date`;
			}
			if (input.dataFim) {
				query = query.whereSql`"dataFim" <= ${input.dataFim}::date`;
			}
			return query;
		},
		transformCreateInput: async (input: any, ctx: any) => {
			const client = await db.clients.findOptional(input.clienteId);
			if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (client.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return input;
		},
		onBeforeUpdate: async (input: any, ctx: any) => {
			await assertContractTeamAccess(input.contractId, ctx.user.teamId);
		},
		onBeforeDelete: async (input: any, ctx: any) => {
			await assertContractTeamAccess(input.contractId, ctx.user.teamId);
		},
		transformListResult: async (items: any[], _input: any, _ctx: any) => {
			if (items.length === 0) return [];
			const clientIds = [...new Set(items.map((c: any) => c.clienteId))] as string[];
			const clients = await db.clients
				.where({ clientId: { in: clientIds } })
				.select('clientId', 'nome');
			const clientMap = new Map(clients.map((c: any) => [c.clientId, c.nome]));
			return items.map((c: any) => ({ ...c, clienteNome: clientMap.get(c.clienteId) ?? null }));
		},
		transformGetByIdResult: async (item: any, _ctx: any) => {
			const client = await db.clients.findOptional(item.clienteId);
			return { ...item, clienteNome: client?.nome ?? null };
		},
	},
});

export const contractsRouterTrpc = trpcRouter({
	listContracts: contractsCrud.list,
	getContractDetail: contractsCrud.getById,
	createContract: contractsCrud.create,
	updateContract: contractsCrud.update,
	deleteContract: contractsCrud.delete,

	activateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ ctx, input: { contractId } }) => {
			const contract = await assertContractTeamAccess(contractId, ctx.user.teamId);
			if (contract.status !== 'Rascunho' && contract.status !== 'Suspenso') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível ativar contrato com status 'Rascunho' ou 'Suspenso'",
				});
			}
			return db.contracts.where({ contractId }).update({ status: 'Ativo' });
		}),

	suspendContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ ctx, input: { contractId } }) => {
			const contract = await assertContractTeamAccess(contractId, ctx.user.teamId);
			if (contract.status !== 'Ativo') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível suspender contrato com status 'Ativo'",
				});
			}
			return db.contracts.where({ contractId }).update({ status: 'Suspenso' });
		}),

	reactivateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ ctx, input: { contractId } }) => {
			const contract = await assertContractTeamAccess(contractId, ctx.user.teamId);
			if (contract.status !== 'Suspenso') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível reativar contrato com status 'Suspenso'",
				});
			}
			return db.contracts.where({ contractId }).update({ status: 'Ativo' });
		}),

	endContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ ctx, input: { contractId } }) => {
			const contract = await assertContractTeamAccess(contractId, ctx.user.teamId);
			if (contract.status === 'Encerrado' || contract.status === 'Cancelado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Não é possível encerrar contrato com status 'Encerrado' ou 'Cancelado'",
				});
			}
			return db.contracts.where({ contractId }).update({ status: 'Encerrado' });
		}),

	cancelContract: protectedProcedure
		.input(
			z.object({
				contractId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input: { contractId, motivoCancelamento } }) => {
			const contract = await assertContractTeamAccess(contractId, ctx.user.teamId);
			if (contract.status === 'Encerrado' || contract.status === 'Cancelado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Não é possível cancelar contrato com status 'Encerrado' ou 'Cancelado'",
				});
			}
			return db.contracts
				.where({ contractId })
				.update({ status: 'Cancelado', motivoCancelamento: motivoCancelamento ?? null });
		}),
});
