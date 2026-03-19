import { BaseTable } from "@backend/db/base_table";
import { WEBHOOK_EVENTO_TIPO_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class WebhooksTable extends BaseTable {
	readonly table = "webhooks";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		url: t.text(),
		eventoTipo: t.enum("webhook_evento_tipo", WEBHOOK_EVENTO_TIPO_ENUM),
		ativo: t.boolean().default(true),
		tentativasMax: t.integer().default(3),
		intervaloRetryMin: t.integer().default(60),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
