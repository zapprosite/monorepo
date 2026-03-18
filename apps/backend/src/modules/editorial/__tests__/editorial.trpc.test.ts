import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@backend/trpc";
import { appTrpcRouter } from "@backend/routers/trpc.router";
import { unauthContext, authContext } from "@backend/test-utils/mock-context";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000002";
const INVALID_UUID = "not-a-uuid";

const VALID_EDITORIAL_INPUT = {
	titulo: "Post Instagram Refrimix",
	canal: "Instagram" as const,
	formato: "Post" as const,
	status: "Ideia" as const,
	dataPublicacao: "2026-04-01",
};

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("editorial — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listEditorialItems rejeita não autenticado", async () => {
		await expect(caller.editorial.listEditorialItems({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getEditorialDetail rejeita não autenticado", async () => {
		await expect(
			caller.editorial.getEditorialDetail({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createEditorialItem rejeita não autenticado", async () => {
		await expect(
			caller.editorial.createEditorialItem(VALID_EDITORIAL_INPUT),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateEditorialItem rejeita não autenticado", async () => {
		await expect(
			caller.editorial.updateEditorialItem({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("moveToProducao rejeita não autenticado", async () => {
		await expect(
			caller.editorial.moveToProducao({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("moveToRevisao rejeita não autenticado", async () => {
		await expect(
			caller.editorial.moveToRevisao({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("approveItem rejeita não autenticado", async () => {
		await expect(
			caller.editorial.approveItem({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("publishItem rejeita não autenticado", async () => {
		await expect(
			caller.editorial.publishItem({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("cancelItem rejeita não autenticado", async () => {
		await expect(
			caller.editorial.cancelItem({ editorialId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe("editorial — validação de input (Zod)", () => {
	const caller = createCaller(authContext());

	it("getEditorialDetail rejeita editorialId inválido", async () => {
		await expect(
			caller.editorial.getEditorialDetail({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("createEditorialItem rejeita sem titulo", async () => {
		await expect(
			// @ts-expect-error — titulo ausente proposital
			caller.editorial.createEditorialItem({
				canal: "Instagram",
				formato: "Post",
				status: "Ideia" as const,
				dataPublicacao: "2026-04-01",
			}),
		).rejects.toThrow();
	});

	it("createEditorialItem rejeita canal inválido", async () => {
		await expect(
			caller.editorial.createEditorialItem({
				titulo: "Título válido",
				canal: "TikTokFake" as unknown as "Instagram",
				formato: "Post",
				status: "Ideia" as const,
				dataPublicacao: "2026-04-01",
			}),
		).rejects.toThrow();
	});

	it("createEditorialItem rejeita formato inválido", async () => {
		await expect(
			caller.editorial.createEditorialItem({
				titulo: "Título válido",
				canal: "Instagram",
				formato: "FormatoInexistente" as unknown as "Post",
				status: "Ideia" as const,
				dataPublicacao: "2026-04-01",
			}),
		).rejects.toThrow();
	});

	it("createEditorialItem rejeita dataPublicacao com formato inválido", async () => {
		await expect(
			caller.editorial.createEditorialItem({
				titulo: "Título válido",
				canal: "Instagram",
				formato: "Post",
				status: "Ideia" as const,
				dataPublicacao: "01-04-2026", // formato errado
			}),
		).rejects.toThrow();
	});

	it("updateEditorialItem rejeita editorialId inválido", async () => {
		await expect(
			caller.editorial.updateEditorialItem({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("moveToProducao rejeita editorialId inválido", async () => {
		await expect(
			caller.editorial.moveToProducao({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("approveItem rejeita editorialId inválido", async () => {
		await expect(
			caller.editorial.approveItem({ editorialId: INVALID_UUID }),
		).rejects.toThrow();
	});
});
