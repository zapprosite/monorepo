import { BaseTable } from "@backend/db/base_table";
import { EVENTO_TIPO_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class EventosTable extends BaseTable {
	readonly table = "eventos";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		tipo: t.enum("evento_tipo", EVENTO_TIPO_ENUM),
		clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
		entidadeId: t.uuid(),
		entidadeTipo: t.text(),
		payload: t.json(),
		processado: t.boolean().default(false),
		createdAt: t.timestamps().createdAt,
	}));
}
