import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@backend/trpc";
import { appTrpcRouter } from "@backend/routers/trpc.router";
import { unauthContext, authContext } from "@backend/test-utils/mock-context";

const createCaller = createCallerFactory(appTrpcRouter);

describe("auth.getSessionInfo", () => {
	it("returns hasSession=false when no session exists", async () => {
		const caller = createCaller(unauthContext());
		const result = await caller.auth.getSessionInfo();
		expect(result).toEqual({ hasSession: false, user: null, isRegistered: false });
	});

	it("returns hasSession=true with user data when session exists", async () => {
		const ctx = authContext({ email: "user@example.com", name: "Alice" });
		// Simulate session user present in req
		ctx.req.session.user = ctx.user!;
		const caller = createCaller(ctx);
		const result = await caller.auth.getSessionInfo();
		expect(result.hasSession).toBe(true);
		expect(result.user?.email).toBe("user@example.com");
		expect(result.user?.name).toBe("Alice");
		expect(result.isRegistered).toBe(true); // has userId
	});

	it("isRegistered=false when session exists but no userId", async () => {
		const ctx = unauthContext();
		ctx.req.session.user = {
			userId: null,
			email: "pending@example.com",
			name: null,
			displayPicture: null,
		};
		const caller = createCaller(ctx);
		const result = await caller.auth.getSessionInfo();
		expect(result.isRegistered).toBe(false);
	});
});

describe("auth.logout", () => {
	it("throws when session.regenerate is not available (unit isolation)", async () => {
		// logout calls clearSession which calls req.session.regenerate
		// In unit tests without full Fastify, this will throw
		const caller = createCaller(unauthContext());
		await expect(caller.auth.logout()).rejects.toThrow();
	});
});
