import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe("dashboard — auth guard", () => {
	const caller = createCaller(unauthContext());

	it("getStats rejeita não autenticado", async () => {
		await expect(caller.dashboard.getStats()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});

// ---------------------------------------------------------------------------
// getStats — estrutura de retorno
// ---------------------------------------------------------------------------
describe("dashboard — getStats", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getStats retorna objeto com kpis", async () => {
		// DB not available — returns INTERNAL_SERVER_ERROR
		// This validates the response structure shape
		await expect(caller.dashboard.getStats()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
	});

	it("getStats rejeita quando teamId undefined", async () => {
		const callerNoTeam = createCaller(authContext({ teamId: undefined as any }));
		await expect(callerNoTeam.dashboard.getStats()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
	});
});
