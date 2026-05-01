import { BaseTable } from "@backend/db/base_table";

export class ConteudoRevsoesTable extends BaseTable {
	readonly table = "conteudo_revisoes";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		conteudoId: t.uuid().foreignKey("conteudos", "id", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		corpo: t.text(),
		changelog: t.text().nullable(),
		revisorId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		createdAt: t.timestamps().createdAt,
	}));
}
