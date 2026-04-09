import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.crm_equipment_status_enum", [
		"Ativo",
		"Em Manutenção",
		"Inativo",
		"Desativado",
	]);

	await db.createTable(
		"units",
		(t) => ({
			unitId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			nome: t.string(255),
			descricao: t.text().nullable(),
			endereco: t.string(255).nullable(),
			cidade: t.string(100).nullable(),
			estado: t.string(2).nullable(),
			responsavelId: t.uuid().nullable(),
			ativa: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"])],
	);

	await db.createTable(
		"equipment",
		(t) => ({
			equipmentId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
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
			nome: t.string(255),
			tipo: t.string(100),
			status: t.enum("crm_equipment_status_enum"),
			marca: t.string(100).nullable(),
			modelo: t.string(100).nullable(),
			numeroDeSerie: t.string(100).nullable(),
			capacidadeBtu: t.integer().nullable(),
			anoFabricacao: t.integer().nullable(),
			dataInstalacao: t.date().nullable(),
			ultimaManutencao: t.date().nullable(),
			observacoes: t.text().nullable(),
			ativo: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["unitId"]), t.index(["status"])],
	);
});
