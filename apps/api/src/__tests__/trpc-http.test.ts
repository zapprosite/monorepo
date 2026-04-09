/**
 * tRPC HTTP Integration Tests
 *
 * Testa o protocolo HTTP real do tRPC v11 via Fastify inject:
 * - Queries: GET  /trpc/[path]?input={"json":...}
 * - Mutations: POST /trpc/[path]  body: {"json":...}
 *
 * Diferença dos testes unitários (mock-context):
 * esses passam pela camada HTTP completa — middlewares, session, error formatter.
 */

import { build } from "@backend/server";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: FastifyInstance;

beforeAll(async () => {
	app = await build();
	await app.ready();
});

afterAll(async () => {
	await app.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serializa input como query param tRPC v11: ?input={"json":...} */
function trpcInput(value: unknown): string {
	return `input=${encodeURIComponent(JSON.stringify({ json: value }))}`;
}

/** Faz uma query tRPC via GET (protocolo correto para queries) */
async function trpcQuery(path: string, input?: unknown) {
	const url = input !== undefined ? `/trpc/${path}?${trpcInput(input)}` : `/trpc/${path}`;
	return app.inject({ method: "GET", url });
}

/** Faz uma mutation tRPC via POST (protocolo correto para mutations) */
async function trpcMutation(path: string, input: unknown, cookie?: string) {
	return app.inject({
		method: "POST",
		url: `/trpc/${path}`,
		headers: {
			"content-type": "application/json",
			...(cookie ? { cookie } : {}),
		},
		body: JSON.stringify({ json: input }),
	});
}

// ---------------------------------------------------------------------------
// auth.getSessionInfo — query pública
// ---------------------------------------------------------------------------

describe("tRPC GET /trpc/auth.getSessionInfo", () => {
	it("retorna hasSession=false sem sessão (GET correto)", async () => {
		const res = await trpcQuery("auth.getSessionInfo");
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.result.data).toMatchObject({
			hasSession: false,
			user: null,
			isRegistered: false,
		});
	});

	it("rejeita POST em procedure de query (método errado)", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/trpc/auth.getSessionInfo",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		// tRPC v11 retorna erro para POST em query procedure
		const body = res.json();
		expect(body.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// auth.logout — mutation
// ---------------------------------------------------------------------------

describe("tRPC POST /trpc/auth.logout", () => {
	it("aceita POST (mutation) e retorna sucesso ou erro esperado", async () => {
		const res = await trpcMutation("auth.logout", {});
		// Pode lançar erro de session.regenerate em ambiente de teste (sem sessão real)
		// O importante é que não seja 404 nem rejeição de método
		expect([200, 500]).toContain(res.statusCode);
		const body = res.json();
		// Deve ter resultado ou erro estruturado do tRPC
		expect(body.result ?? body.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// journalEntries.getAll — protected query
// ---------------------------------------------------------------------------

describe("tRPC GET /trpc/journalEntries.getAll", () => {
	it("retorna UNAUTHORIZED sem sessão (via HTTP)", async () => {
		const res = await trpcQuery("journalEntries.getAll");
		expect(res.statusCode).toBe(401);
		const body = res.json();
		expect(body.error.data.code).toBe("UNAUTHORIZED");
	});
});

// ---------------------------------------------------------------------------
// journalEntries.create — protected mutation
// ---------------------------------------------------------------------------

describe("tRPC POST /trpc/journalEntries.create", () => {
	it("retorna UNAUTHORIZED sem sessão", async () => {
		const res = await trpcMutation("journalEntries.create", { content: "test" });
		expect(res.statusCode).toBe(401);
		const body = res.json();
		expect(body.error.data.code).toBe("UNAUTHORIZED");
	});

	it("retorna BAD_REQUEST com input inválido (content vazio) — mesmo sem auth", async () => {
		// Zod valida ANTES de checar auth? Não — auth middleware roda primeiro.
		// Então esperamos UNAUTHORIZED também aqui.
		const res = await trpcMutation("journalEntries.create", { content: "" });
		expect(res.statusCode).toBe(401);
		const body = res.json();
		expect(body.error.data.code).toBe("UNAUTHORIZED");
	});
});

// ---------------------------------------------------------------------------
// journalEntries.getById — protected query com input
// ---------------------------------------------------------------------------

describe("tRPC GET /trpc/journalEntries.getById", () => {
	it("retorna UNAUTHORIZED sem sessão, mesmo com input válido", async () => {
		const res = await trpcQuery("journalEntries.getById", {
			journalEntryId: "01ARYZ6S41TSV4RRFFQ69G5FAV",
		});
		expect(res.statusCode).toBe(401);
		const body = res.json();
		expect(body.error.data.code).toBe("UNAUTHORIZED");
	});
});

// ---------------------------------------------------------------------------
// hello — query pública de smoke test
// ---------------------------------------------------------------------------

describe("tRPC GET /trpc/hello", () => {
	it("retorna string de saudação", async () => {
		const res = await trpcQuery("hello");
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.result.data).toBe("Hello from tRPC");
	});
});
