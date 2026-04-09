import { BaseTable } from "@backend/db/base_table";
import {
	WEBHOOK_STATUS_ENUM,
	WEBHOOK_EVENTO_TIPO_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class WebhookDeliveriesTable extends BaseTable {
	readonly table = "webhook_deliveries";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		webhookId: t.uuid().foreignKey("webhooks", "id", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		eventoId: t.uuid(),
		eventoTipo: t.enum("webhook_evento_tipo", WEBHOOK_EVENTO_TIPO_ENUM),
		payload: t.json(),
		statusEntrega: t.enum("webhook_status", WEBHOOK_STATUS_ENUM).default("pendente"),
		tentativaAtual: t.integer().default(0),
		proximaTentativa: t.timestamp().nullable(),
		respostaHttp: t.integer().nullable(),
		erroMensagem: t.text().nullable(),
		...t.timestamps(),
	}));
}
