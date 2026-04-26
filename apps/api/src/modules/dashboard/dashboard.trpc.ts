import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";

export const dashboardRouterTrpc = trpcRouter({
	getStats: protectedProcedure.query(async ({ ctx }) => {
		// IDOR FIX: extract teamId from authenticated user context
		// NOTE: ctx.user.teamId requires SessionUser to include teamId
		// and CRM tables (clients, leads, contracts, reminders, schedules, serviceOrders)
		// must have teamId column added via migration
		const teamId = (ctx.user as { teamId?: string }).teamId;

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
			db.clients.where({ teamId }).count(),
			db.leads.where({ teamId }).count(),
			db.contracts.where({ teamId, status: "Ativo" }).count(),
			db.reminders.where({ teamId, status: "Pendente" }).count(),
			db.schedules.whereSql`${teamId} = "teamId" AND DATE("dataHora") = CURRENT_DATE`.count(),
			db.serviceOrders.where({ teamId, status: "Aberta" }).count(),
			db.contracts
				.where({ teamId })
				.order({ createdAt: "DESC" })
				.limit(5)
				.select("contractId", "tipo", "status", "dataInicio", "valor", "clienteId"),
			db.schedules.whereSql`${teamId} = "teamId" AND "dataHora" >= NOW()`
				.order({ dataHora: "ASC" })
				.limit(5)
				.select("scheduleId", "tipo", "status", "dataHora", "clienteId"),
			db.reminders
				.where({ teamId, status: "Pendente" })
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
