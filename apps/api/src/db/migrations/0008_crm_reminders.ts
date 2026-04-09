import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.crm_reminder_type_enum", [
		"Ligação",
		"Email",
		"Visita",
		"Manutenção",
		"Renovação",
	]);

	await db.createEnum("public.crm_reminder_status_enum", ["Pendente", "Concluído", "Cancelado"]);

	await db.createTable(
		"reminders",
		(t) => ({
			reminderId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			tipo: t.enum("crm_reminder_type_enum"),
			status: t.enum("crm_reminder_status_enum"),
			dataLembrete: t.date(),
			titulo: t.varchar(255),
			descricao: t.text().nullable(),
			scheduleId: t.uuid().nullable(),
			contractId: t.uuid().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["status"]), t.index(["dataLembrete"])],
	);
});
