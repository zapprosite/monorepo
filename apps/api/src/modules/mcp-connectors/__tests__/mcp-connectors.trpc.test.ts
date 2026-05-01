import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);
const FAKE_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe("mcp-connectors — auth guard", () => {
	const caller = createCaller(unauthContext());

	it("create rejeita não autenticado", async () => {
		await expect(
			caller.mcpConnectors.create({
				provider: "claude",
				apiKey: "sk-test",
				configuracao: {},
				clienteId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("list rejeita não autenticado", async () => {
		await expect(caller.mcpConnectors.list({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getById rejeita não autenticado", async () => {
		await expect(
			caller.mcpConnectors.getById({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("update rejeita não autenticado", async () => {
		await expect(
			caller.mcpConnectors.update({ id: FAKE_UUID, data: {} }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("delete rejeita não autenticado", async () => {
		await expect(
			caller.mcpConnectors.delete({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateStatus rejeita não autenticado", async () => {
		await expect(
			caller.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "ativo" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// create — team isolation via clienteId
// ---------------------------------------------------------------------------
describe("mcp-connectors — create team isolation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("create lança NOT_FOUND para cliente inexistente", async () => {
		await expect(
			caller.mcpConnectors.create({
				provider: "claude",
				apiKey: "sk-test",
				configuracao: {},
				clienteId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("create lança FORBIDDEN para cliente de outro team", async () => {
		const callerOther = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOther.mcpConnectors.create({
				provider: "claude",
				apiKey: "sk-test",
				configuracao: {},
				clienteId: FAKE_UUID,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("create lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.mcpConnectors.create({
				provider: "claude",
				apiKey: "sk-test",
				configuracao: {},
				clienteId: "not-a-uuid",
			} as any),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// list — team isolation (direct teamId filter)
// ---------------------------------------------------------------------------
describe("mcp-connectors — list team isolation", () => {
	it("list retorna array para team autenticado", async () => {
		const caller = createCaller(authContext({ teamId: "team-01" }));
		const result = await caller.mcpConnectors.list({});
		expect(result).toBeInstanceOf(Array);
	});

	it("list com filtro clienteId retorna array", async () => {
		const caller = createCaller(authContext({ teamId: "team-01" }));
		const result = await caller.mcpConnectors.list({ clienteId: FAKE_UUID });
		expect(result).toBeInstanceOf(Array);
	});
});

// ---------------------------------------------------------------------------
// getById — team isolation
// ---------------------------------------------------------------------------
describe("mcp-connectors — getById team isolation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getById lança NOT_FOUND para conector inexistente", async () => {
		await expect(
			caller.mcpConnectors.getById({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("getById lança FORBIDDEN para conector de outro team", async () => {
		const callerOther = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOther.mcpConnectors.getById({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("getById lança erro para UUID inválido", async () => {
		await expect(
			caller.mcpConnectors.getById({ id: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// update — team isolation
// ---------------------------------------------------------------------------
describe("mcp-connectors — update team isolation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("update lança NOT_FOUND para conector inexistente", async () => {
		await expect(
			caller.mcpConnectors.update({ id: FAKE_UUID, data: {} }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("update lança FORBIDDEN para conector de outro team", async () => {
		const callerOther = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOther.mcpConnectors.update({ id: FAKE_UUID, data: {} }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

// ---------------------------------------------------------------------------
// delete — team isolation
// ---------------------------------------------------------------------------
describe("mcp-connectors — delete team isolation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("delete lança NOT_FOUND para conector inexistente", async () => {
		await expect(
			caller.mcpConnectors.delete({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("delete lança FORBIDDEN para conector de outro team", async () => {
		const callerOther = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOther.mcpConnectors.delete({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

// ---------------------------------------------------------------------------
// updateStatus — team isolation + enum validation
// ---------------------------------------------------------------------------
describe("mcp-connectors — updateStatus validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("updateStatus lança NOT_FOUND para conector inexistente", async () => {
		await expect(
			caller.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "ativo" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("updateStatus lança FORBIDDEN para conector de outro team", async () => {
		const callerOther = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOther.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "ativo" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("updateStatus lança erro para status inválido", async () => {
		await expect(
			caller.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "invalid" } as any),
		).rejects.toThrow();
	});

	it("updateStatus aceita status válido 'ativo'", async () => {
		await expect(
			caller.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "ativo" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" }); // conector não existe
	});

	it("updateStatus aceita status válido 'inativo'", async () => {
		await expect(
			caller.mcpConnectors.updateStatus({ id: FAKE_UUID, status: "inativo" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
