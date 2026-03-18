import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";

export const dashboardRouterTrpc = trpcRouter({
	getStats: protectedProcedure.query(async () => {
		const [
			totalClients,
			totalLeads,
			activeContracts,
			pendingReminders,
			todaySchedules,
			openServiceOrders,
			recentContracts,
			upcomingSchedules,
			pendingRemindersList,
		] = await Promise.all([
			db.clients.count(),
			db.leads.count(),
			db.contracts.where({ status: "Ativo" }).count(),
			db.reminders.where({ status: "Pendente" }).count(),
			db.schedules.whereSql`DATE("dataHora") = CURRENT_DATE`.count(),
			db.serviceOrders.where({ status: "Aberta" }).count(),
			db.contracts
				.order({ createdAt: "DESC" })
				.limit(5)
				.select("contractId", "tipo", "status", "dataInicio", "valor", "clienteId"),
			db.schedules
				.whereSql`"dataHora" >= NOW()`
				.order({ dataHora: "ASC" })
				.limit(5)
				.select("scheduleId", "tipo", "status", "dataHora", "clienteId"),
			db.reminders
				.where({ status: "Pendente" })
				.order({ dataLembrete: "ASC" })
				.limit(5)
				.select("reminderId", "titulo", "tipo", "dataLembrete", "clienteId"),
		]);

		return {
			kpis: {
				totalClients: Number(totalClients),
				totalLeads: Number(totalLeads),
				activeContracts: Number(activeContracts),
				pendingReminders: Number(pendingReminders),
				todaySchedules: Number(todaySchedules),
				openServiceOrders: Number(openServiceOrders),
			},
			recentContracts,
			upcomingSchedules,
			pendingRemindersList,
		};
	}),
});
