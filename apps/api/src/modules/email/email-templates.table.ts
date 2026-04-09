import { BaseTable } from "@backend/db/base_table";
import { CATEG_TEMPLATE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class EmailTemplatesTable extends BaseTable {
	readonly table = "email_templates";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nome: t.text(),
		assunto: t.text(),
		corpo: t.text(),
		categoriTemplate: t.enum("categ_template", CATEG_TEMPLATE_ENUM),
		variavelSuportadas: t.json().nullable(),
		ativo: t.boolean().default(true),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
