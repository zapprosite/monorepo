import { BaseTable } from "@backend/db/base_table";

export class MaterialItemTable extends BaseTable {
	readonly table = "material_items";

	columns = this.setColumns((t) => ({
		materialItemId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		serviceOrderId: t.uuid().foreignKey("service_orders", "serviceOrderId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		descricao: t.varchar(255),
		quantidade: t.numeric(10, 3),
		unidade: t.varchar(20),
		valorUnitario: t.numeric(10, 2).nullable(),
		...t.timestamps(),
	}));
}
