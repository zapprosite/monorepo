import { BaseTable } from "@backend/db/base_table";
import { TIPO_EQUIPAMENTO_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class MaintenancePlansTable extends BaseTable {
	readonly table = "maintenance_plans";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nomeEmpresa: t.text(),
		descricao: t.text().nullable(),
		tipoEquipamento: t.enum("tipo_equipamento", TIPO_EQUIPAMENTO_ENUM),
		periodicidadeDias: t.integer(),
		carga: t.text().nullable(),
		refrigerante: t.text().nullable(),
		ultimaManutencao: t.timestamp().nullable(),
		proxima: t.timestamp().nullable(),
		horasEstimadas: t.integer().default(2),
		custoEstimado: t.decimal(10, 2).default(0),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		equipamentoId: t.uuid().foreignKey("equipment", "equipmentId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		contratoId: t
			.uuid()
			.nullable()
			.foreignKey("contracts", "contractId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			}),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
