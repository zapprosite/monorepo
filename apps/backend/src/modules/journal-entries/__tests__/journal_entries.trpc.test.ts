import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

describe("journalEntries — unauthenticated access (UNAUTHORIZED guard)", () => {
	const caller = createCaller(unauthContext());

	it("getAll rejects unauthenticated", async () => {
		await expect(caller.journalEntries.getAll()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getById rejects unauthenticated", async () => {
		await expect(
			caller.journalEntries.getById({ journalEntryId: "01JTEST000000000000000001" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("create rejects unauthenticated", async () => {
		await expect(caller.journalEntries.create({ content: "test entry" })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("delete rejects unauthenticated", async () => {
		await expect(
			caller.journalEntries.delete({ journalEntryId: "01JTEST000000000000000001" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("journalEntries — input validation", () => {
	const caller = createCaller(authContext());

	it("create rejects empty content (Zod validation)", async () => {
		await expect(caller.journalEntries.create({ content: "" })).rejects.toThrow();
	});

	it("create rejects content over 50000 chars", async () => {
		await expect(caller.journalEntries.create({ content: "x".repeat(50001) })).rejects.toThrow();
	});
});
