import { BaseTable } from "@backend/db/base_table";

export class KanbanBoardsTable extends BaseTable {
	readonly table = "kanban_boards";

	columns = this.setColumns((t) => ({
		boardId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		nome: t.text(),
		setor: t.text(),
		descricao: t.text().nullable(),
		cor: t.varchar(7).nullable(),
		...t.timestamps(),
	}));
}
