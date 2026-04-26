// @ts-nocheck - migration file with complex orchid-orm types
import { change } from "../db_script";

change(async (db) => {
	// Create enums for Slice 13, 14, 15
	await db.createEnum("public.evento_tipo", [
		"manutencao.agendada",
		"manutencao.concluida",
		"fidelidade.nivel-alterado",
		"fidelidade.risco-deteccao",
		"campanha.enviada",
		"campanha.aberta",
	]);

	await db.createEnum("public.webhook_status", [
		"pendente",
		"enviado",
		"falha-retry",
		"falha-definitiva",
		"cancelado",
	]);

	await db.createEnum("public.webhook_evento_tipo", [
		"maintenance.scheduled",
		"loyalty.tier_changed",
		"loyalty.reactivation_triggered",
		"campaign.sent",
		"campaign.opened",
		"campaign.clicked",
	]);

	await db.createEnum("public.mcp_provider", ["claude", "anthropic", "make", "zapier"]);

	await db.createEnum("public.mcp_conectar_status", ["ativo", "inativo", "erro", "pendente"]);

	await db.createEnum("public.conteudo_tipo", [
		"blog-post",
		"faq",
		"landing-page",
		"guia-usuario",
		"case-study",
	]);

	await db.createEnum("public.conteudo_status", [
		"rascunho",
		"revisao",
		"aprovado",
		"publicado",
		"arquivado",
	]);

	// SLICE 13 - WEBHOOKS & EVENTS
	// Webhooks table
	await db.createTable(
		"webhooks",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			url: t.text(),
			eventoTipo: t.enum("webhook_evento_tipo"),
			ativo: t.boolean().default(true),
			tentativasMax: t.integer().default(3),
			intervaloRetryMin: t.integer().default(60),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["eventoTipo"]), t.index(["ativo"])],
	);

	// Webhook delivery queue
	await db.createTable(
		"webhook_deliveries",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			webhookId: t.uuid().foreignKey("webhooks", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			eventoId: t.uuid(),
			eventoTipo: t.enum("webhook_evento_tipo"),
			payload: t.json(),
			statusEntrega: t.enum("webhook_status").default("pendente"),
			tentativaAtual: t.integer().default(0),
			proximaTentativa: t.timestamp().nullable(),
			respostaHttp: t.integer().nullable(),
			erroMensagem: t.text().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["webhookId"]), t.index(["statusEntrega"]), t.index(["proximaTentativa"])],
	);

	// Events audit log
	await db.createTable(
		"eventos",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			tipo: t.enum("evento_tipo"),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			entidadeId: t.uuid(),
			entidadeTipo: t.text(),
			payload: t.json(),
			processado: t.boolean().default(false),
			createdAt: t.timestamps().createdAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["tipo"]), t.index(["processado"])],
	);

	// SLICE 14 - MCP CONNECTORS
	await db.createTable(
		"mcp_conectores",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			provider: t.enum("mcp_provider"),
			status: t.enum("mcp_conectar_status").default("pendente"),
			apiKey: t.text(),
			configuracao: t.json().nullable(),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			usuarioCriacaoId: t.uuid().foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			ultimaTentativaSync: t.timestamp().nullable(),
			erroUltimaTentativa: t.text().nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["provider"]), t.index(["status"])],
	);

	// SLICE 15 - CONTENT ENGINE
	await db.createTable(
		"conteudos",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			titulo: t.text(),
			slug: t.text(),
			descricao: t.text().nullable(),
			corpo: t.text(),
			tipo: t.enum("conteudo_tipo"),
			status: t.enum("conteudo_status").default("rascunho"),
			geradoIA: t.boolean().default(false),
			seoTitulo: t.text().nullable(),
			seoDescricao: t.text().nullable(),
			seoSlug: t.text().nullable(),
			metaTags: t.json().nullable(),
			dataPublicacao: t.timestamp().nullable(),
			clienteId: t.uuid().foreignKey("clients", "clientId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			autorId: t.uuid().foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["clienteId"]), t.index(["tipo"]), t.index(["status"]), t.index(["slug"])],
	);

	// Content revisions
	await db.createTable(
		"conteudo_revisoes",
		(t) => ({
			id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
			conteudoId: t.uuid().foreignKey("conteudos", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			corpo: t.text(),
			changelog: t.text().nullable(),
			revisorId: t.uuid().foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			createdAt: t.timestamps().createdAt,
		}),
		(t) => [t.index(["conteudoId"]), t.index(["revisorId"])],
	);
});
