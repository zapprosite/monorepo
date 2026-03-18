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
			query = query.whereSql`"dataInicio" <= ${fim}::date`;
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
			if (!contract) throw new Error("Contrato não encontrado");

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
		return db.contracts.create(input);
	}),

	updateContract: protectedProcedure
		.input(contractUpdateInputZod)
		.mutation(async ({ input: { contractId, ...data } }) => {
			return db.contracts.find(contractId).update(data);
		}),

	activateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			return db.contracts.find(contractId).update({ status: "Ativo" });
		}),

	suspendContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			return db.contracts.find(contractId).update({ status: "Suspenso" });
		}),

	reactivateContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			return db.contracts.find(contractId).update({ status: "Ativo" });
		}),

	endContract: protectedProcedure
		.input(contractGetByIdZod)
		.mutation(async ({ input: { contractId } }) => {
			return db.contracts.find(contractId).update({ status: "Encerrado" });
		}),

	cancelContract: protectedProcedure
		.input(
			z.object({
				contractId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ input: { contractId, motivoCancelamento } }) => {
			return db.contracts
				.find(contractId)
				.update({ status: "Cancelado", motivoCancelamento: motivoCancelamento ?? null });
		}),
});
