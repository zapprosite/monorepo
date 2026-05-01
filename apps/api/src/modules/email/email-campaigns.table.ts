import { BaseTable } from "@backend/db/base_table";
import {
	TIPO_CAMPANHA_ENUM,
	STATUS_CAMPANHA_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class EmailCampaignsTable extends BaseTable {
	readonly table = "email_campaigns";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nome: t.text(),
		descricao: t.text().nullable(),
		tipoCampanha: t.enum("tipo_campanha", TIPO_CAMPANHA_ENUM),
		templateId: t
			.uuid()
			.nullable()
			.foreignKey("email_templates", "id", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			}),
		destinatariosJSON: t.json(),
		statusCampanha: t.enum("status_campanha", STATUS_CAMPANHA_ENUM).default("rascunho"),
		dataAgendada: t.timestamp().nullable(),
		dataEnvio: t.timestamp().nullable(),
		totalEnviado: t.integer().default(0),
		totalAberto: t.integer().default(0),
		totalClicado: t.integer().default(0),
		taxaAberturaPercent: t.decimal(5, 2).default(0),
		usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		...t.timestamps(),
	}));
}
