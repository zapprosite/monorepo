import { BaseTable } from "@backend/db/base_table";
import {
	CONTEUDO_TIPO_ENUM,
	CONTEUDO_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class ConteudosTable extends BaseTable {
	readonly table = "conteudos";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		titulo: t.text(),
		slug: t.text(),
		descricao: t.text().nullable(),
		corpo: t.text(),
		tipo: t.enum("conteudo_tipo", CONTEUDO_TIPO_ENUM),
		status: t.enum("conteudo_status", CONTEUDO_STATUS_ENUM).default("rascunho"),
		geradoIA: t.boolean().default(false),
		seoTitulo: t.text().nullable(),
		seoDescricao: t.text().nullable(),
		seoSlug: t.text().nullable(),
		metaTags: t.json().nullable(),
		dataPublicacao: t.timestamp().nullable(),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		autorId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
