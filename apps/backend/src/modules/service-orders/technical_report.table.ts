import { BaseTable } from "@backend/db/base_table";

export class TechnicalReportTable extends BaseTable {
	readonly table = "technical_reports";

	columns = this.setColumns((t) => ({
		reportId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		serviceOrderId: t.uuid().foreignKey("service_orders", "serviceOrderId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		diagnostico: t.text(),
		servicosExecutados: t.text(),
		observacoes: t.text().nullable(),
		assinadoTecnico: t.boolean().default(false),
		assinadoCliente: t.boolean().default(false),
		...t.timestamps(),
	}));
}
