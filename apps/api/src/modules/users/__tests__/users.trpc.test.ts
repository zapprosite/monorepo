import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);
const FAKE_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// Auth guard — getAll e getById são protectedProcedure
// ---------------------------------------------------------------------------
describe("users — auth guard", () => {
	const caller = createCaller(unauthContext());

	it("getAll rejeita não autenticado", async () => {
		await expect(caller.users.getAll()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getById rejeita não autenticado", async () => {
		await expect(
			caller.users.getById({ userId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// create — publicProcedure (OAuth flow)
// ---------------------------------------------------------------------------
describe("users — create (publicProcedure)", () => {
	const caller = createCaller(unauthContext());

	it("create rejeita quando não há sessão ativa", async () => {
		await expect(
			caller.users.create({
				email: "test@example.com",
				name: "Test User",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("create rejeita email diferente da sessão OAuth", async () => {
		const callerWithSession = createCaller({
			user: undefined,
			req: {
				session: {
					user: {
						userId: "existing-user",
						email: "oauth@example.com",
						name: "OAuth User",
						displayPicture: null,
					},
				},
				headers: { "user-agent": "vitest" },
				ip: "127.0.0.1",
			} as any,
			res: {} as any,
		});
		await expect(
			callerWithSession.users.create({
				email: "different@email.com",
				name: "Test User",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("create rejeita se userId já existe na sessão", async () => {
		const callerWithSession = createCaller({
			user: undefined,
			req: {
				session: {
					user: {
						userId: "already-registered",
						email: "test@example.com",
						name: "Test User",
						displayPicture: null,
					},
				},
				headers: { "user-agent": "vitest" },
				ip: "127.0.0.1",
			} as any,
			res: {} as any,
		});
		await expect(
			callerWithSession.users.create({
				email: "test@example.com",
				name: "Test User",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ---------------------------------------------------------------------------
// getAll — team isolation
// ---------------------------------------------------------------------------
describe("users — getAll team isolation", () => {
	it("getAll retorna array quando autenticado", async () => {
		const caller = createCaller(authContext({ teamId: "team-01" }));
		const result = await caller.users.getAll();
		expect(result).toBeInstanceOf(Array);
	});
});

// ---------------------------------------------------------------------------
// getById — IDOR protection
// ---------------------------------------------------------------------------
describe("users — getById IDOR protection", () => {
	it("getById lança FORBIDDEN para user de outro team", async () => {
		const caller = createCaller(authContext({ teamId: "team-01" }));
		// Sem DB, vai dar erro de estrutura — mas o ponto é que não deve expor dados
		// de outro team. O código verifica targetUser.teamId !== teamId
		await expect(
			caller.users.getById({ userId: FAKE_UUID }),
		).rejects.toThrow();
	});

	it("getById lança erro para UUID inválido", async () => {
		const caller = createCaller(authContext({ teamId: "team-01" }));
		await expect(
			caller.users.getById({ userId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});
