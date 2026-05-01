import { BaseTable } from "@backend/db/base_table";
import { SCHEDULE_STATUS_ENUM, SERVICE_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class ScheduleTable extends BaseTable {
	readonly table = "schedules";

	columns = this.setColumns((t) => ({
		scheduleId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		unitId: t
			.uuid()
			.foreignKey("units", "unitId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			})
			.nullable(),
		equipmentId: t
			.uuid()
			.foreignKey("equipment", "equipmentId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			})
			.nullable(),
		tecnicoId: t.uuid().nullable(),
		dataHora: t.timestamp(),
		duracaoMinutos: t.integer().default(60),
		tipo: t.enum("crm_service_type_enum", SERVICE_TYPE_ENUM),
		status: t.enum("crm_schedule_status_enum", SCHEDULE_STATUS_ENUM),
		descricao: t.text().nullable(),
		observacoes: t.text().nullable(),
		motivoCancelamento: t.text().nullable(),
		...t.timestamps(),
	}));
}
