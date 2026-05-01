import { BaseTable } from "@backend/db/base_table";
import { LEAD_SOURCE_ENUM, LEAD_STATUS_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class LeadsTable extends BaseTable {
	readonly table = "leads";

	columns = this.setColumns((t) => ({
		leadId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nome: t.string(255),
		email: t.string().nullable(),
		telefone: t.string(30).nullable(),
		origem: t.enum("crm_lead_source_enum", LEAD_SOURCE_ENUM),
		canal: t.string(100).nullable(),
		status: t.enum("crm_lead_status_enum", LEAD_STATUS_ENUM),
		responsavelId: t.uuid().nullable(),
		observacoes: t.text().nullable(),
		convertidoClienteId: t.uuid().nullable(),
		...t.timestamps(),
	}));
}
