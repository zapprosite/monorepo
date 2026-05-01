// @ts-nocheck - migration file with complex orchid-orm types
import { change } from "../db_script";

change(async (db) => {
	await db.createEnum("public.crm_contract_status_enum", [
		"Rascunho",
		"Ativo",
		"Suspenso",
		"Encerrado",
		"Cancelado",
	]);

	await db.createEnum("public.crm_contract_type_enum", ["Comercial", "PMOC", "Residencial"]);

	await db.createEnum("public.crm_contract_frequency_enum", [
		"Mensal",
		"Bimestral",
		"Trimestral",
		"Semestral",
		"Anual",
	]);

	await db.createTable(
		"contracts",
		(t) => ({
			contractId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			tipo: t.enum("crm_contract_type_enum"),
			status: t.enum("crm_contract_status_enum"),
			dataInicio: t.date(),
			dataFim: t.date().nullable(),
			valor: t.decimal(12, 2).nullable(),
			frequencia: t.enum("crm_contract_frequency_enum").nullable(),
			descricao: t.text().nullable(),
			observacoes: t.text().nullable(),
			motivoCancelamento: t.text().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["clienteId"]),
			t.index(["status"]),
			t.index(["tipo"]),
			t.index(["dataInicio"]),
		],
	);
});
