import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.crm_schedule_status_enum", [
		"Agendado",
		"Confirmado",
		"Em Andamento",
		"Concluído",
		"Cancelado",
	]);

	await db.createEnum("public.crm_service_type_enum", [
		"Instalação",
		"Manutenção Preventiva",
		"Manutenção Corretiva",
		"Limpeza",
		"Recarga de Gás",
		"Visita Técnica",
	]);

	await db.createTable(
		"schedules",
		(t) => ({
			scheduleId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			unitId: t
				.uuid()
				.foreignKey("units", "unitId", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			equipmentId: t
				.uuid()
				.foreignKey("equipment", "equipmentId", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			tecnicoId: t.uuid().nullable(),
			dataHora: t.timestamp(),
			duracaoMinutos: t.integer().default(60),
			tipo: t.enum("crm_service_type_enum"),
			status: t.enum("crm_schedule_status_enum"),
			descricao: t.text().nullable(),
			observacoes: t.text().nullable(),
			motivoCancelamento: t.text().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["clienteId"]),
			t.index(["tecnicoId"]),
			t.index(["status"]),
			t.index(["dataHora"]),
		],
	);
});
