import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.user_role_enum", [
		"Admin",
		"Gestor",
		"Comercial",
		"Marketing",
		"Tecnico",
		"Atendimento",
		"Financeiro",
	]);

	await db.createTable(
		"user_roles",
		(t) => ({
			userRoleId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			userId: t.uuid().foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			role: t.enum("user_role_enum"),
			assignedAt: t.timestamp().default(t.sql`now()`),
			assignedByUserId: t
				.uuid()
				.nullable()
				.foreignKey("users", "userId", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				}),
		}),
		(t) => [t.unique(["userId", "role"]), t.index(["role"])],
	);
});
