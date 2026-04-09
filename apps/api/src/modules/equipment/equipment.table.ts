import { BaseTable } from "@backend/db/base_table";
import { EQUIPMENT_STATUS_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class EquipmentTable extends BaseTable {
	readonly table = "equipment";

	columns = this.setColumns((t) => ({
		equipmentId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
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
		nome: t.string(255),
		tipo: t.string(100),
		status: t.enum("crm_equipment_status_enum", EQUIPMENT_STATUS_ENUM),
		marca: t.string(100).nullable(),
		modelo: t.string(100).nullable(),
		numeroDeSerie: t.string(100).nullable(),
		capacidadeBtu: t.integer().nullable(),
		anoFabricacao: t.integer().nullable(),
		dataInstalacao: t.date().nullable(),
		ultimaManutencao: t.date().nullable(),
		observacoes: t.text().nullable(),
		ativo: t.boolean().default(true),
		...t.timestamps(),
	}));
}
