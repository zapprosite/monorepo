import { dbConfig } from "@backend/db/config";
import { SessionTable } from "@backend/modules/auth/tables/session.auth.table";
import { AddressesTable } from "@backend/modules/clients/addresses.table";
import { ClientsTable } from "@backend/modules/clients/clients.table";
import { ContactsTable } from "@backend/modules/clients/contacts.table";
import { UnitsTable } from "@backend/modules/clients/units.table";
import { ContractsTable } from "@backend/modules/contracts/contracts.table";
import { EditorialTable } from "@backend/modules/editorial/editorial.table";
import { EquipmentTable } from "@backend/modules/equipment/equipment.table";
import { JournalEntryTable } from "@backend/modules/journal-entries/tables/journal_entries.table";
import { LeadsTable } from "@backend/modules/leads/leads.table";
import { ApiProductRequestLogsTable } from "@backend/modules/logs/tables/api_product_request_logs.table";
import { PromptsTable } from "@backend/modules/prompts/tables/prompts.table";
import { ReminderTable } from "@backend/modules/reminders/reminder.table";
import { ScheduleTable } from "@backend/modules/schedule/schedule.table";
import { MaterialItemTable } from "@backend/modules/service-orders/material_item.table";
import { ServiceOrderTable } from "@backend/modules/service-orders/service_order.table";
import { TechnicalReportTable } from "@backend/modules/service-orders/technical_report.table";
import { SubscriptionsTable } from "@backend/modules/subscriptions/tables/subscriptions.table";
import { WebhookCallQueueTable } from "@backend/modules/subscriptions/tables/webhookCallQueue.table";
import { TeamTable } from "@backend/modules/teams/tables/teams.table";
import { UserRolesTable } from "@backend/modules/users/user-roles.table";
import { UserTable } from "@backend/modules/users/users/users.table";
import { orchidORM } from "orchid-orm/node-postgres";

const databaseURL = `postgres://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}?ssl=${dbConfig.ssl ? "require" : "false"}`;

export const db = orchidORM(
	{
		databaseURL,
		// log: true,
	},
	{
		users: UserTable,
		journalEntries: JournalEntryTable,
		prompts: PromptsTable,
		sessions: SessionTable,
		subscriptions: SubscriptionsTable,
		teams: TeamTable,
		apiProductRequestLogs: ApiProductRequestLogsTable,
		webhookCallQueues: WebhookCallQueueTable,
		leads: LeadsTable,
		clients: ClientsTable,
		contacts: ContactsTable,
		addresses: AddressesTable,
		units: UnitsTable,
		equipment: EquipmentTable,
		schedules: ScheduleTable,
		contracts: ContractsTable,
		serviceOrders: ServiceOrderTable,
		technicalReports: TechnicalReportTable,
		materialItems: MaterialItemTable,
		editorialItems: EditorialTable,
		reminders: ReminderTable,
		userRoles: UserRolesTable,
	},
);
