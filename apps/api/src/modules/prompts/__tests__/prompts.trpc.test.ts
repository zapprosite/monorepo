import { appTrpcRouter } from "@backend/routers/trpc.router";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

// ---------------------------------------------------------------------------
// prompts — publicProcedure (sem auth necessária)
// ---------------------------------------------------------------------------
describe("prompts — public endpoints", () => {
	const caller = createCaller({
		user: undefined,
		req: { session: { user: undefined }, headers: {}, ip: "127.0.0.1" } as any,
		res: {} as any,
	});

	it("getAllActive retorna array (público)", async () => {
		const result = await caller.prompts.getAllActive();
		expect(result).toBeInstanceOf(Array);
	});

	it("getById lança erro para UUID inválido", async () => {
		await expect(
			caller.prompts.getById({ promptId: "not-a-uuid" }),
		).rejects.toThrow();
	});

	it("getByCategory retorna array (público)", async () => {
		const result = await caller.prompts.getByCategory({ isActive: true });
		expect(result).toBeInstanceOf(Array);
	});
});
