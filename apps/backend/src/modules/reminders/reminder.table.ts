import { BaseTable } from "@backend/db/base_table";
import {
	REMINDER_TYPE_ENUM,
	REMINDER_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class ReminderTable extends BaseTable {
	readonly table = "reminders";

	columns = this.setColumns((t) => ({
		reminderId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		tipo: t.enum("crm_reminder_type_enum", REMINDER_TYPE_ENUM),
		status: t.enum("crm_reminder_status_enum", REMINDER_STATUS_ENUM),
		dataLembrete: t.date(),
		titulo: t.varchar(255),
		descricao: t.text().nullable(),
		scheduleId: t.uuid().nullable(),
		contractId: t.uuid().nullable(),
		...t.timestamps(),
	}));
}
