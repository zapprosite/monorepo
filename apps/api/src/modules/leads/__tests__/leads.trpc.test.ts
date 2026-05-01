import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000001";
const FAKE_UUID_2 = "00000000-0000-0000-0000-000000000002";
const FAKE_UUID_3 = "00000000-0000-0000-0000-000000000003";

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("leads — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listLeads rejeita não autenticado", async () => {
		await expect(caller.leads.listLeads({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getLeadDetail rejeita não autenticado", async () => {
		await expect(
			caller.leads.getLeadDetail({ leadId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createLead rejeita não autenticado", async () => {
		await expect(
			caller.leads.createLead({
				nome: "Test Lead",
				email: "lead@example.com",
				telefone: "+5511999999999",
				status: "Novo",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateLead rejeita não autenticado", async () => {
		await expect(
			caller.leads.updateLead({ leadId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("convertLeadToClient rejeita não autenticado", async () => {
		await expect(
			caller.leads.convertLeadToClient({ leadId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// listLeads — filtros
// ---------------------------------------------------------------------------
describe("leads — listLeads filters", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("listLeads sem filtros retorna array", async () => {
		const result = await caller.leads.listLeads({});
		expect(Array.isArray(result)).toBe(true);
	});

	it("listLeads com filtro status", async () => {
		const result = await caller.leads.listLeads({ status: "Novo" });
		expect(Array.isArray(result)).toBe(true);
	});

	it("listLeads com filtro origem", async () => {
		const result = await caller.leads.listLeads({ origem: "Website" });
		expect(Array.isArray(result)).toBe(true);
	});

	it("listLeads com filtro responsavelId", async () => {
		const result = await caller.leads.listLeads({ responsavelId: FAKE_UUID });
		expect(Array.isArray(result)).toBe(true);
	});

	it("listLeads com search term", async () => {
		const result = await caller.leads.listLeads({ search: "João" });
		expect(Array.isArray(result)).toBe(true);
	});

	it("listLeads com múltiplos filtros", async () => {
		const result = await caller.leads.listLeads({
			status: "Qualificado",
			origem: "Indicação",
			search: "Silva",
		});
		expect(Array.isArray(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getLeadDetail — NOT_FOUND
// ---------------------------------------------------------------------------
describe("leads — getLeadDetail NOT_FOUND", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getLeadDetail lança NOT_FOUND para lead inexistente", async () => {
		await expect(
			caller.leads.getLeadDetail({ leadId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

// ---------------------------------------------------------------------------
// createLead — criação
// ---------------------------------------------------------------------------
describe("leads — createLead", () => {
	const caller = createCaller(authContext({ teamId: "team-create" }));

	it("createLead cria lead com campos obrigatórios", async () => {
		const result = await caller.leads.createLead({
			nome: "Lead Novo",
			email: "leadnovo@example.com",
			telefone: "+5511988887777",
			status: "Novo",
		});
		expect(result).toMatchObject({
			nome: "Lead Novo",
			email: "leadnovo@example.com",
			status: "Novo",
		});
		expect(result.leadId).toBeDefined();
		expect(result.teamId).toBe("team-create");
	});

	it("createLead com origem", async () => {
		const result = await caller.leads.createLead({
			nome: "Lead Origem",
			email: "origem@example.com",
			telefone: "+5511977776666",
			status: "Novo",
			origem: "Email Marketing",
		});
		expect(result).toMatchObject({ origem: "Email Marketing" });
	});
});

// ---------------------------------------------------------------------------
// updateLead — NOT_FOUND e FORBIDDEN
// ---------------------------------------------------------------------------
describe("leads — updateLead NOT_FOUND", () => {
	const caller = createCaller(authContext({ teamId: "team-update" }));

	it("updateLead lança NOT_FOUND para lead inexistente", async () => {
		await expect(
			caller.leads.updateLead({ leadId: FAKE_UUID, nome: "Nome Atualizado" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("leads — updateLead FORBIDDEN (cross-team)", () => {
	it("updateLead lança FORBIDDEN se lead pertence a outro team", async () => {
		// Caller com team-A tenta actualizar lead de team-B
		const callerTeamA = createCaller(authContext({ teamId: "team-a" }));
		// Primeiro criar lead belong to team-b
		const callerTeamB = createCaller(authContext({ teamId: "team-b" }));
		const created = await callerTeamB.leads.createLead({
			nome: "Lead Team B",
			email: "teamb@example.com",
			telefone: "+5511966665555",
			status: "Novo",
		});
		// Team A tenta actualizar
		await expect(
			callerTeamA.leads.updateLead({ leadId: created.leadId, nome: "Hack" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

// ---------------------------------------------------------------------------
// convertLeadToClient — conversão
// ---------------------------------------------------------------------------
describe("leads — convertLeadToClient", () => {
	const caller = createCaller(authContext({ teamId: "team-convert" }));

	it("convertLeadToClient lança NOT_FOUND para lead inexistente", async () => {
		await expect(
			caller.leads.convertLeadToClient({ leadId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
