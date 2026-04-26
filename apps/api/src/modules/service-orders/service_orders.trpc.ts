import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	materialItemCreateInputZod,
	materialItemsByServiceOrderZod,
} from "@connected-repo/zod-schemas/material_item.zod";
import {
	listServiceOrdersFilterZod,
	serviceOrderCreateInputZod,
	serviceOrderGetByIdZod,
	serviceOrderUpdateInputZod,
} from "@connected-repo/zod-schemas/service_order.zod";
import {
	technicalReportByServiceOrderZod,
	technicalReportCreateInputZod,
	technicalReportUpdateInputZod,
} from "@connected-repo/zod-schemas/technical_report.zod";

const SERVICE_ORDERS_MAX_LIMIT = 200;
const RELATED_MAX_LIMIT = 100;

export const serviceOrdersRouterTrpc = trpcRouter({
	// — Service Orders —

	listServiceOrders: protectedProcedure
		.input(listServiceOrdersFilterZod)
		.query(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			let query = db.serviceOrders.select("serviceOrders.*").innerJoin("clients", "serviceOrders.clienteId", "clients.clientId").where("clients.teamId", teamId);

			if (input.clienteId) query = query.where({ "serviceOrders.clienteId": input.clienteId });
			if (input.tecnicoId) query = query.where({ "serviceOrders.tecnicoId": input.tecnicoId });
			if (input.equipmentId) query = query.where({ "serviceOrders.equipmentId": input.equipmentId });
			if (input.status) query = query.where({ "serviceOrders.status": input.status });
			if (input.tipo) query = query.where({ "serviceOrders.tipo": input.tipo });
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"serviceOrders"."numero" ILIKE ${term}`;
			}

			return query.order({ dataAbertura: "DESC" }).limit(SERVICE_ORDERS_MAX_LIMIT);
		}),

	getServiceOrderDetail: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			// Verify ownership via client
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return order;
		}),

	createServiceOrder: protectedProcedure
		.input(serviceOrderCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const cliente = await db.clients.where({ clientId: input.clienteId, teamId }).findOptional(input.clienteId);
			if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (input.tecnicoId) {
				const tecnico = await db.users.findOptional(input.tecnicoId);
				if (!tecnico) throw new TRPCError({ code: "NOT_FOUND", message: "Técnico não encontrado" });
			}
			if (input.equipmentId) {
				const equipment = await db.equipment.findOptional(input.equipmentId);
				if (!equipment) throw new TRPCError({ code: "NOT_FOUND", message: "Equipamento não encontrado" });
			}
			return db.serviceOrders.create(input);
		}),

	updateServiceOrder: protectedProcedure
		.input(serviceOrderUpdateInputZod)
		.mutation(async ({ ctx, input: { serviceOrderId, ...data } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.serviceOrders.where({ serviceOrderId }).update(data);
		}),

	iniciarAtendimento: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			if (order.status !== "Aberta") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível iniciar atendimento com status 'Aberta'" });
			}
			return db.serviceOrders.where({ serviceOrderId }).update({ status: "Em Andamento" });
		}),

	concluirOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			if (order.status !== "Em Andamento") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível concluir ordem com status 'Em Andamento'" });
			}
			const dataFechamento = new Date().toISOString();
			if (new Date(dataFechamento) < new Date(order.dataAbertura)) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Data de fechamento não pode ser anterior à data de abertura" });
			}
			return db.serviceOrders.where({ serviceOrderId }).update({
				status: "Concluída",
				dataFechamento,
			});
		}),

	cancelarOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			if (order.status === "Concluída" || order.status === "Cancelada") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível cancelar ordem com status 'Concluída' ou 'Cancelada'" });
			}
			return db.serviceOrders.where({ serviceOrderId }).update({ status: "Cancelada" });
		}),

	// — Technical Reports —

	getReportByServiceOrder: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.technicalReports.where({ serviceOrderId }).takeOptional();
		}),

	createReport: protectedProcedure
		.input(technicalReportCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(input.serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.technicalReports.create(input);
		}),

	updateReport: protectedProcedure
		.input(technicalReportUpdateInputZod)
		.mutation(async ({ ctx, input: { reportId, ...data } }) => {
			const { teamId } = ctx.user;
			const report = await db.technicalReports.findOptional(reportId);
			if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório técnico não encontrado" });
			const order = await db.serviceOrders.findOptional(report.serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.technicalReports.where({ reportId }).update(data);
		}),

	assinarTecnico: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			const report = await db.technicalReports.where({ serviceOrderId }).takeOptional();
			if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório técnico não encontrado" });
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoTecnico: true });
		}),

	assinarCliente: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			const report = await db.technicalReports.where({ serviceOrderId }).takeOptional();
			if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório técnico não encontrado" });
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoCliente: true });
		}),

	// — Material Items —

	listMaterials: protectedProcedure
		.input(materialItemsByServiceOrderZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
			const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.materialItems
				.where({ serviceOrderId })
				.order({ createdAt: "ASC" })
				.limit(RELATED_MAX_LIMIT);
		}),

	addMaterial: protectedProcedure.input(materialItemCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		const order = await db.serviceOrders.findOptional(input.serviceOrderId);
		if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de Serviço não encontrada" });
		const cliente = await db.clients.where({ clientId: order.clienteId, teamId }).findOptional(order.clienteId);
		if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
		return db.materialItems.create(input);
	}),
});
