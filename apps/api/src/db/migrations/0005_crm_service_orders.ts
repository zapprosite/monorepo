import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.crm_service_order_status_enum", [
		"Aberta",
		"Em Andamento",
		"Aguardando Peças",
		"Concluída",
		"Cancelada",
	]);

	await db.createTable(
		"service_orders",
		(t) => ({
			serviceOrderId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			numero: t
				.varchar(50)
				.default(
					t.sql`'OS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)`,
				),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			scheduleId: t
				.uuid()
				.foreignKey("schedules", "scheduleId", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
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
			tipo: t.enum("crm_service_type_enum"),
			status: t.enum("crm_service_order_status_enum"),
			dataAbertura: t.timestamp(),
			dataFechamento: t.timestamp().nullable(),
			descricao: t.text().nullable(),
			observacoes: t.text().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["clienteId"]),
			t.index(["tecnicoId"]),
			t.index(["status"]),
			t.index(["scheduleId"]),
		],
	);

	await db.createTable(
		"technical_reports",
		(t) => ({
			reportId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			serviceOrderId: t.uuid().foreignKey("service_orders", "serviceOrderId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			diagnostico: t.text(),
			servicosExecutados: t.text(),
			observacoes: t.text().nullable(),
			assinadoTecnico: t.boolean().default(false),
			assinadoCliente: t.boolean().default(false),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["serviceOrderId"])],
	);

	await db.createTable(
		"material_items",
		(t) => ({
			materialItemId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			serviceOrderId: t.uuid().foreignKey("service_orders", "serviceOrderId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			descricao: t.varchar(255),
			quantidade: t.numeric(10, 3),
			unidade: t.varchar(20),
			valorUnitario: t.numeric(10, 2).nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["serviceOrderId"])],
	);
});
