import { BaseTable } from "@backend/db/base_table";
import {
	EDITORIAL_CHANNEL_ENUM,
	EDITORIAL_FORMAT_ENUM,
	EDITORIAL_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class EditorialTable extends BaseTable {
	readonly table = "editorial_calendar_items";

	columns = this.setColumns((t) => ({
		editorialId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		teamId: t.uuid(),
		titulo: t.varchar(255),
		canal: t.enum("crm_editorial_channel_enum", EDITORIAL_CHANNEL_ENUM),
		formato: t.enum("crm_editorial_format_enum", EDITORIAL_FORMAT_ENUM),
		status: t.enum("crm_editorial_status_enum", EDITORIAL_STATUS_ENUM),
		dataPublicacao: t.date(),
		pauta: t.text().nullable(),
		copy: t.text().nullable(),
		cta: t.varchar(255).nullable(),
		observacoes: t.text().nullable(),
		campanhaId: t.uuid().nullable(),
		...t.timestamps(),
	}));
}
