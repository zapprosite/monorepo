import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	contractCreateInputZod,
	contractGetByIdZod,
	contractUpdateInputZod,
	listContractFilterZod,
} from "@connected-repo/zod-schemas/contract.zod";
import z from "zod";

const CONTRACTS_MAX_LIMIT = 500;

export const contractsRouterTrpc = trpcRouter({
	listContracts: protectedProcedure.input(listContractFilterZod).query(async ({ input }) => {
		let query = db.contracts.select("*");

		if (input.clienteId) {
			query = query.where({ clienteId: input.clienteId });
		}
		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.tipo) {
			query = query.where({ tipo: input.tipo });
		}
		if (input.dataInicio) {
			const inicio = input.dataInicio;
			query = query.whereSql`"dataInicio" >= ${inicio}::date`;
		}
		if (input.dataFim) {
			const fim = input.dataFim;
			query = query.whereSql`"dataFim" <= ${fim}::date`;
		}

		const contracts = await query.order({ dataInicio: "DESC" }).limit(CONTRACTS_MAX_LIMIT);

		if (contracts.length === 0) return [];

		const clientIds = [...new Set(contracts.map((c) => c.clienteId))];
		const clients = await db.clients
			.where({ clientId: { in: clientIds } })
			.select("clientId", "nome");

		const clientMap = new Map(clients.map((c) => [c.clientId, c.nome]));

		return contracts.map((c) => ({
			...c,
			clienteNome: clientMap.get(c.clienteId) ?? null,
		}));
	}),

	getContractDetail: protectedProcedure
		.input(contractGetByIdZod)
		.query(async ({ input: { contractId } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });

			const client = await db.clients
				.where({ clientId: contract.clienteId })
				.select("clientId", "nome")
				.findOptional(contract.clienteId);

			return {
				...contract,
				clienteNome: client?.nome ?? null,
			};
		}),

	createContract: protectedProcedure.input(contractCreateInputZod).mutation(async ({ input }) => {
		const cliente = await db.clients.findOptional(input.clienteId);
		if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
		return db.contracts.create(input);
	}),

	updateContract: protectedProcedure
		.input(contractUpdateInputZod)
		.mutation(async ({ input: { contractId, ...data } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			return db.contracts.where({ contractId }).update(data);
		}),

	activateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			if (contract.status !== "Rascunho" && contract.status !== "Suspenso") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível ativar contrato com status 'Rascunho' ou 'Suspenso'" });
			}
			return db.contracts.where({ contractId }).update({ status: "Ativo" });
		}),

	suspendContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			if (contract.status !== "Ativo") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível suspender contrato com status 'Ativo'" });
			}
			return db.contracts.where({ contractId }).update({ status: "Suspenso" });
		}),

	reactivateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			if (contract.status !== "Suspenso") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível reativar contrato com status 'Suspenso'" });
			}
			return db.contracts.where({ contractId }).update({ status: "Ativo" });
		}),

	endContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			if (contract.status === "Encerrado" || contract.status === "Cancelado") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível encerrar contrato com status 'Encerrado' ou 'Cancelado'" });
			}
			return db.contracts.where({ contractId }).update({ status: "Encerrado" });
		}),

	cancelContract: protectedProcedure
		.input(
			z.object({
				contractId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ input: { contractId, motivoCancelamento } }) => {
			const contract = await db.contracts.findOptional(contractId);
			if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
			if (contract.status === "Encerrado" || contract.status === "Cancelado") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível cancelar contrato com status 'Encerrado' ou 'Cancelado'" });
			}
			return db.contracts.where({ contractId }).update({ status: "Cancelado", motivoCancelamento: motivoCancelamento ?? null });
		}),
});
