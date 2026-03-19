import { BaseTable } from "@backend/db/base_table";
import { STATUS_MANUTENCAO_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class MaintenanceSchedulesTable extends BaseTable {
	readonly table = "maintenance_schedules";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		planoManutencaoId: t.uuid().foreignKey("maintenance_plans", "id", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		dataAgendada: t.timestamp(),
		statusManutencao: t.enum("status_manutencao", STATUS_MANUTENCAO_ENUM).default("agendada"),
		tecnicoAtribuidoId: t
			.uuid()
			.nullable()
			.foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			}),
		notasExecucao: t.text().nullable(),
		materialUsado: t.json().nullable(),
		tempoExecucao: t.integer().nullable(),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
