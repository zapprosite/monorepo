import { BaseTable } from "@backend/db/base_table";
import {
	KANBAN_CARD_PRIORITY_ENUM,
	KANBAN_CARD_STATUS_ENUM,
} from "@connected-repo/zod-schemas/crm_enums.zod";

export class KanbanCardsTable extends BaseTable {
	readonly table = "kanban_cards";

	columns = this.setColumns((t) => ({
		cardId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		columnId: t.uuid().foreignKey("kanban_columns", "columnId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		titulo: t.text(),
		descricao: t.text().nullable(),
		prioridade: t
			.enum("kanban_card_priority_enum", KANBAN_CARD_PRIORITY_ENUM)
			.default("Media"),
		status: t
			.enum("kanban_card_status_enum", KANBAN_CARD_STATUS_ENUM)
			.default("Aberto"),
		responsavelId: t
			.uuid()
			.nullable()
			.foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			}),
		dataVencimento: t.date().nullable(),
		ordem: t.integer().default(0),
		...t.timestamps(),
	}));
}
