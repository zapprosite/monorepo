import { authRouterTrpc } from "@backend/modules/auth/auth.trpc";
import { clientsRouterTrpc } from "@backend/modules/clients/clients.trpc";
import { contractsRouterTrpc } from "@backend/modules/contracts/contracts.trpc";
import { kanbanRouterTrpc } from "@backend/modules/kanban/kanban.trpc";
import { dashboardRouterTrpc } from "@backend/modules/dashboard/dashboard.trpc";
import { editorialRouterTrpc } from "@backend/modules/editorial/editorial.trpc";
import { equipmentRouterTrpc } from "@backend/modules/equipment/equipment.trpc";
import { journalEntriesRouterTrpc } from "@backend/modules/journal-entries/journal_entries.trpc";
import { leadsRouterTrpc } from "@backend/modules/leads/leads.trpc";
import { promptsRouterTrpc } from "@backend/modules/prompts/prompts.trpc";
import { remindersRouterTrpc } from "@backend/modules/reminders/reminders.trpc";
import { scheduleRouterTrpc } from "@backend/modules/schedule/schedule.trpc";
import { serviceOrdersRouterTrpc } from "@backend/modules/service-orders/service_orders.trpc";
import { userRolesRouterTrpc } from "@backend/modules/users/user-roles.trpc";
import { usersRouterTrpc } from "@backend/modules/users/users.trpc";
import { maintenanceRouter } from "@backend/modules/maintenance/maintenance.trpc";
import { loyaltyRouter } from "@backend/modules/loyalty/loyalty.trpc";
import { emailRouter } from "@backend/modules/email/email.trpc";
import { webhookRouter } from "@backend/modules/webhooks/webhooks.trpc";
import { mcpConectorRouter } from "@backend/modules/mcp-connectors/mcp-conectores.trpc";
import { conteudoRouter } from "@backend/modules/content-engine/conteudos.trpc";
import { publicProcedure, trpcRouter } from "@backend/trpc";

export const appTrpcRouter = trpcRouter({
	hello: publicProcedure.query(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return "Hello from tRPC";
	}),

	auth: authRouterTrpc,
	dashboard: dashboardRouterTrpc,
	journalEntries: journalEntriesRouterTrpc,
	prompts: promptsRouterTrpc,
	users: usersRouterTrpc,
	leads: leadsRouterTrpc,
	clients: clientsRouterTrpc,
	equipment: equipmentRouterTrpc,
	schedule: scheduleRouterTrpc,
	contracts: contractsRouterTrpc,
	serviceOrders: serviceOrdersRouterTrpc,
	editorial: editorialRouterTrpc,
	reminders: remindersRouterTrpc,
	userRoles: userRolesRouterTrpc,
	kanban: kanbanRouterTrpc,
	maintenance: maintenanceRouter,
	loyalty: loyaltyRouter,
	email: emailRouter,
	webhooks: webhookRouter,
	mcpConectores: mcpConectorRouter,
	conteudos: conteudoRouter,
});

export type AppTrpcRouter = typeof appTrpcRouter;
// export type RouterOutputs = inferRouterOutputs<AppTrpcRouter>;
