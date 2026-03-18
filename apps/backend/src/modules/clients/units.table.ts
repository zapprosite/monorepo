import { BaseTable } from "@backend/db/base_table";

export class UnitsTable extends BaseTable {
	readonly table = "units";

	columns = this.setColumns((t) => ({
		unitId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		nome: t.string(255),
		descricao: t.text().nullable(),
		endereco: t.string(255).nullable(),
		cidade: t.string(100).nullable(),
		estado: t.string(2).nullable(),
		responsavelId: t.uuid().nullable(),
		ativa: t.boolean().default(true),
		...t.timestamps(),
	}));
}
