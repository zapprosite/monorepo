import { BaseTable } from "@backend/db/base_table";
import { CLIENT_TYPE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class ClientsTable extends BaseTable {
	readonly table = "clients";

	columns = this.setColumns((t) => ({
		clientId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nome: t.string(255),
		tipo: t.enum("crm_client_type_enum", CLIENT_TYPE_ENUM),
		email: t.string().nullable(),
		telefone: t.string(30).nullable(),
		cpfCnpj: t.string(18).nullable(),
		responsavelId: t.uuid().nullable(),
		tags: t.array(t.string()).nullable(),
		ativo: t.boolean().default(true),
		...t.timestamps(),
	}));
}
