import { BaseTable } from "@backend/db/base_table";

export class KanbanColumnsTable extends BaseTable {
	readonly table = "kanban_columns";

	columns = this.setColumns((t) => ({
		columnId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		boardId: t.uuid().foreignKey("kanban_boards", "boardId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		nome: t.text(),
		ordem: t.integer().default(0),
		limite: t.integer().nullable(),
	}));
}
