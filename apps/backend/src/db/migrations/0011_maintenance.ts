import { change } from "../db_script";

change(async (db) => {
	// Create enums
	await db.createEnum("public.tipo_equipamento", [
		"ar-condicionado",
		"refrigerador",
		"freezer",
		"climatizador",
	]);

	await db.createEnum("public.status_manutencao", [
		"agendada",
		"em-progresso",
		"concluida",
		"cancelada",
		"adiada",
	]);

	await db.createEnum("public.nivel_fidelidade", [
		"bronze",
		"prata",
		"ouro",
		"platinum",
	]);

	await db.createEnum("public.status_reativacao", [
		"ativo",
		"risco-30d",
		"risco-60d",
		"risco-90d",
		"perdido",
	]);

	await db.createEnum("public.tipo_campanha", [
		"marketing",
		"reativacao",
		"newsletter",
		"promocional",
		"transacional",
	]);

	await db.createEnum("public.status_campanha", [
		"rascunho",
		"agendada",
		"enviando",
		"enviada",
		"cancelada",
	]);

	await db.createEnum("public.categ_template", [
		"bem-vindo",
		"reativacao",
		"promocional",
		"newsletter",
		"confirmacao",
	]);

	// Maintenance Plans table
	await db.createTable(
		"maintenance_plans",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			nomeEmpresa: t.text(),
			descricao: t.text().nullable(),
			tipoEquipamento: t.enum("tipo_equipamento"),
			periodicidadeDias: t.integer(),
			carga: t.text().nullable(),
			refrigerante: t.text().nullable(),
			ultimaManutencao: t.timestamp().nullable(),
			proxima: t.timestamp().nullable(),
			horasEstimadas: t.integer().default(2),
			custoEstimado: t.decimal(10, 2).default(0),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			equipamentoId: t.uuid().foreignKey("equipment", "equipmentId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			contratoId: t.uuid().foreignKey("contracts", "contractId", {
			onUpdate: "RESTRICT",
			onDelete: "SET NULL",
		}).nullable(),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["clienteId"]),
			t.index(["equipamentoId"]),
		],
	);

	// Maintenance Schedules table
	await db.createTable(
		"maintenance_schedules",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			planoManutencaoId: t
				.uuid()
				.foreignKey("maintenance_plans", "id", { onDelete: "CASCADE" }),
			dataAgendada: t.timestamp(),
			statusManutencao: t.enum("status_manutencao").default("agendada"),
			tecnicoAtribuidoId: t
				.uuid()
				.nullable()
				.foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			notasExecucao: t.text().nullable(),
			materialUsado: t.json().nullable(),
			tempoExecucao: t.integer().nullable(),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["planoManutencaoId"]),
			t.index(["dataAgendada"]),
		],
	);

	// Loyalty Scores table
	await db.createTable(
		"loyalty_scores",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			clienteId: t
				.uuid()
				.foreignKey("clients", "clientId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
			pontos: t.integer().default(0),
			nivel: t.enum("nivel_fidelidade").default("bronze"),
			ultimaCompra: t.timestamp().nullable(),
			diasSemContato: t.integer().default(0),
			statusReativacao: t.enum("status_reativacao").default("ativo"),
			dataProximaReativacao: t.timestamp().nullable(),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["clienteId"]),
			t.index(["statusReativacao"]),
		],
	);

	// Email Templates table (must be created before email_campaigns due to FK)
	await db.createTable(
		"email_templates",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			nome: t.text(),
			assunto: t.text(),
			corpo: t.text(),
			categoriTemplate: t.enum("categ_template"),
			variavelSuportadas: t.json().nullable(),
			ativo: t.boolean().default(true),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["categoriTemplate"]),
		],
	);

	// Email Campaigns table
	await db.createTable(
		"email_campaigns",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			nome: t.text(),
			descricao: t.text().nullable(),
			tipoCampanha: t.enum("tipo_campanha"),
			templateId: t
				.uuid()
				.nullable()
				.foreignKey("email_templates", "id", {
			onUpdate: "RESTRICT",
			onDelete: "SET NULL",
		}),
			destinatariosJSON: t.json(),
			statusCampanha: t.enum("status_campanha").default("rascunho"),
			dataAgendada: t.timestamp().nullable(),
			dataEnvio: t.timestamp().nullable(),
			totalEnviado: t.integer().default(0),
			totalAberto: t.integer().default(0),
			totalClicado: t.integer().default(0),
			taxaAberturaPercent: t.decimal(5, 2).default(0),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "RESTRICT",
		}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["statusCampanha"]),
		],
	);
});
