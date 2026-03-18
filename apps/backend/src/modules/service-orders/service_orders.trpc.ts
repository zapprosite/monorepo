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
		.query(async ({ input }) => {
			let query = db.serviceOrders.select("*");

			if (input.clienteId) query = query.where({ clienteId: input.clienteId });
			if (input.tecnicoId) query = query.where({ tecnicoId: input.tecnicoId });
			if (input.equipmentId) query = query.where({ equipmentId: input.equipmentId });
			if (input.status) query = query.where({ status: input.status });
			if (input.tipo) query = query.where({ tipo: input.tipo });
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"numero" ILIKE ${term}`;
			}

			return query.order({ dataAbertura: "DESC" }).limit(SERVICE_ORDERS_MAX_LIMIT);
		}),

	getServiceOrderDetail: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.query(async ({ input: { serviceOrderId } }) => {
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order) throw new Error("Ordem de Serviço não encontrada");
			return order;
		}),

	createServiceOrder: protectedProcedure
		.input(serviceOrderCreateInputZod)
		.mutation(async ({ input }) => {
			return db.serviceOrders.create(input);
		}),

	updateServiceOrder: protectedProcedure
		.input(serviceOrderUpdateInputZod)
		.mutation(async ({ input: { serviceOrderId, ...data } }) => {
			return db.serviceOrders.find(serviceOrderId).update(data);
		}),

	iniciarAtendimento: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ input: { serviceOrderId } }) => {
			return db.serviceOrders.find(serviceOrderId).update({ status: "Em Andamento" });
		}),

	concluirOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ input: { serviceOrderId } }) => {
			return db.serviceOrders.find(serviceOrderId).update({
				status: "Concluída",
				dataFechamento: new Date().toISOString(),
			});
		}),

	cancelarOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ input: { serviceOrderId } }) => {
			return db.serviceOrders.find(serviceOrderId).update({ status: "Cancelada" });
		}),

	// — Technical Reports —

	getReportByServiceOrder: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.query(async ({ input: { serviceOrderId } }) => {
			return db.technicalReports.where({ serviceOrderId }).takeOptional();
		}),

	createReport: protectedProcedure
		.input(technicalReportCreateInputZod)
		.mutation(async ({ input }) => {
			return db.technicalReports.create(input);
		}),

	updateReport: protectedProcedure
		.input(technicalReportUpdateInputZod)
		.mutation(async ({ input: { reportId, ...data } }) => {
			return db.technicalReports.find(reportId).update(data);
		}),

	assinarTecnico: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ input: { serviceOrderId } }) => {
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoTecnico: true });
		}),

	assinarCliente: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ input: { serviceOrderId } }) => {
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoCliente: true });
		}),

	// — Material Items —

	listMaterials: protectedProcedure
		.input(materialItemsByServiceOrderZod)
		.query(async ({ input: { serviceOrderId } }) => {
			return db.materialItems
				.where({ serviceOrderId })
				.order({ createdAt: "ASC" })
				.limit(RELATED_MAX_LIMIT);
		}),

	addMaterial: protectedProcedure.input(materialItemCreateInputZod).mutation(async ({ input }) => {
		return db.materialItems.create(input);
	}),
});
