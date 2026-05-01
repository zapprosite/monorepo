import { BaseTable } from "@backend/db/base_table";
import {
	SERVICE_ORDER_STATUS_ENUM,
	SERVICE_TYPE_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class ServiceOrderTable extends BaseTable {
	readonly table = "service_orders";

	columns = this.setColumns((t) => ({
		serviceOrderId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		numero: t
			.varchar(50)
			.default(
				t.sql`'OS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)`,
			),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		scheduleId: t
			.uuid()
			.foreignKey("schedules", "scheduleId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			})
			.nullable(),
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
		tipo: t.enum("crm_service_type_enum", SERVICE_TYPE_ENUM),
		status: t.enum("crm_service_order_status_enum", SERVICE_ORDER_STATUS_ENUM),
		dataAbertura: t.timestamp(),
		dataFechamento: t.timestamp().nullable(),
		descricao: t.text().nullable(),
		observacoes: t.text().nullable(),
		...t.timestamps(),
	}));
}
