// @ts-nocheck - migration file with complex orchid-orm types
import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.kanban_card_priority_enum", [
		"Baixa",
		"Media",
		"Alta",
		"Critica",
	]);

	await db.createEnum("public.kanban_card_status_enum", [
		"Aberto",
		"Em Andamento",
		"Bloqueado",
		"Concluido",
		"Cancelado",
	]);

	await db.createTable(
		"kanban_boards",
		(t) => ({
			boardId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			nome: t.text(),
			setor: t.text(),
			descricao: t.text().nullable(),
			cor: t.varchar(7).nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(_t) => [],
	);

	await db.createTable(
		"kanban_columns",
		(t) => ({
			columnId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			boardId: t.uuid().foreignKey("kanban_boards", "boardId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			nome: t.text(),
			ordem: t.integer().default(0),
			limite: t.integer().nullable(),
		}),
		(t) => [t.index(["boardId"])],
	);

	await db.createTable(
		"kanban_cards",
		(t) => ({
			cardId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			columnId: t.uuid().foreignKey("kanban_columns", "columnId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			titulo: t.text(),
			descricao: t.text().nullable(),
			prioridade: t.enum("kanban_card_priority_enum").default("Media"),
			status: t.enum("kanban_card_status_enum").default("Aberto"),
			responsavelId: t
				.uuid()
				.nullable()
				.foreignKey("users", "userId", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				}),
			dataVencimento: t.date().nullable(),
			ordem: t.integer().default(0),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["columnId"]),
			t.index(["responsavelId"]),
			t.index(["status"]),
		],
	);
});
