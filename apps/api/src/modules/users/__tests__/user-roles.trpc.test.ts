import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000001";
const INVALID_UUID = "not-a-uuid";

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("userRoles — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("getMyRoles rejeita não autenticado", async () => {
		await expect(caller.userRoles.getMyRoles()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("listUserRoles rejeita não autenticado", async () => {
		await expect(caller.userRoles.listUserRoles({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("assignRole rejeita não autenticado", async () => {
		await expect(
			caller.userRoles.assignRole({ userId: FAKE_UUID, role: "Admin" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("revokeRole rejeita não autenticado", async () => {
		await expect(
			caller.userRoles.revokeRole({ userId: FAKE_UUID, role: "Admin" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe("userRoles — validação de input (Zod)", () => {
	const caller = createCaller(authContext());

	it("listUserRoles rejeita userId com formato inválido", async () => {
		await expect(
			caller.userRoles.listUserRoles({ userId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("listUserRoles rejeita role inválido", async () => {
		await expect(
			caller.userRoles.listUserRoles({ role: "RoleInexistente" as unknown as "Admin" }),
		).rejects.toThrow();
	});

	it("assignRole rejeita userId inválido", async () => {
		await expect(
			caller.userRoles.assignRole({ userId: INVALID_UUID, role: "Admin" }),
		).rejects.toThrow();
	});

	it("assignRole rejeita role inválido", async () => {
		await expect(
			caller.userRoles.assignRole({
				userId: FAKE_UUID,
				role: "RoleInexistente" as unknown as "Admin",
			}),
		).rejects.toThrow();
	});

	it("revokeRole rejeita userId inválido", async () => {
		await expect(
			caller.userRoles.revokeRole({ userId: INVALID_UUID, role: "Gestor" }),
		).rejects.toThrow();
	});

	it("revokeRole rejeita role inválido", async () => {
		await expect(
			caller.userRoles.revokeRole({
				userId: FAKE_UUID,
				role: "RoleInexistente" as unknown as "Gestor",
			}),
		).rejects.toThrow();
	});
});
