import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);
const FAKE_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe("content-engine — auth guard", () => {
	const caller = createCaller(unauthContext());

	it("create rejeita não autenticado", async () => {
		await expect(
			caller.contentEngine.create({
				titulo: "Test",
				slug: "test",
				descricao: "Test",
				corpo: "Body",
				tipo: "blog-post",
				status: "rascunho",
				geradoIA: false,
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("list rejeita não autenticado", async () => {
		await expect(
			caller.contentEngine.list({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("getById rejeita não autenticado", async () => {
		await expect(
			caller.contentEngine.getById({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("getBySlug rejeita não autenticado", async () => {
		await expect(
			caller.contentEngine.getBySlug({ slug: "test", clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// create — validação de input
// ---------------------------------------------------------------------------
describe("content-engine — create validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("create lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.contentEngine.create({
				titulo: "Test",
				slug: "test",
				descricao: "Test",
				corpo: "Body",
				tipo: "blog-post",
				status: "rascunho",
				geradoIA: false,
				clienteId: "not-a-uuid",
			} as any),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// list — team isolation
// ---------------------------------------------------------------------------
describe("content-engine — list team isolation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("list lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.contentEngine.list({ clienteId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getById — NOT_FOUND / team isolation
// ---------------------------------------------------------------------------
describe("content-engine — getById validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getById lança NOT_FOUND para conteúdo inexistente", async () => {
		await expect(
			caller.contentEngine.getById({ id: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("getById lança erro para UUID inválido", async () => {
		await expect(
			caller.contentEngine.getById({ id: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getBySlug — NOT_FOUND
// ---------------------------------------------------------------------------
describe("content-engine — getBySlug validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getBySlug lança NOT_FOUND para slug inexistente", async () => {
		await expect(
			caller.contentEngine.getBySlug({ slug: "inexistente", clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("getBySlug lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.contentEngine.getBySlug({ slug: "test", clienteId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});
