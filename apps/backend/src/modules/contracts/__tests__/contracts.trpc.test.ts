import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@backend/trpc";
import { appTrpcRouter } from "@backend/routers/trpc.router";
import { unauthContext, authContext } from "@backend/test-utils/mock-context";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000001";
const INVALID_UUID = "not-a-uuid";

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("contracts — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listContracts rejeita não autenticado", async () => {
		await expect(caller.contracts.listContracts({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getContractDetail rejeita não autenticado", async () => {
		await expect(
			caller.contracts.getContractDetail({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: FAKE_UUID,
				tipo: "Comercial",
				status: "Rascunho",
				dataInicio: "2026-01-01",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.updateContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("activateContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.activateContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("suspendContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.suspendContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("reactivateContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.reactivateContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("endContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.endContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("cancelContract rejeita não autenticado", async () => {
		await expect(
			caller.contracts.cancelContract({ contractId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe("contracts — validação de input (Zod)", () => {
	const caller = createCaller(authContext());

	it("getContractDetail rejeita contractId inválido", async () => {
		await expect(
			caller.contracts.getContractDetail({ contractId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("createContract rejeita clienteId inválido", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: INVALID_UUID,
				tipo: "Comercial",
				status: "Rascunho",
				dataInicio: "2026-01-01",
			}),
		).rejects.toThrow();
	});

	it("createContract rejeita tipo inválido", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: FAKE_UUID,
				// @ts-expect-error — tipo inválido proposital
				tipo: "TipoInexistente",
				status: "Rascunho",
				dataInicio: "2026-01-01",
			}),
		).rejects.toThrow();
	});

	it("createContract rejeita status inválido", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: FAKE_UUID,
				tipo: "PMOC",
				// @ts-expect-error — status inválido proposital
				status: "Inexistente",
				dataInicio: "2026-01-01",
			}),
		).rejects.toThrow();
	});

	it("createContract rejeita dataInicio com formato inválido", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: FAKE_UUID,
				tipo: "Residencial",
				status: "Rascunho",
				dataInicio: "01/01/2026", // formato errado — deve ser YYYY-MM-DD
			}),
		).rejects.toThrow();
	});

	it("createContract rejeita valor negativo", async () => {
		await expect(
			caller.contracts.createContract({
				clienteId: FAKE_UUID,
				tipo: "Comercial",
				status: "Rascunho",
				dataInicio: "2026-01-01",
				valor: -100,
			}),
		).rejects.toThrow();
	});

	it("updateContract rejeita contractId inválido", async () => {
		await expect(
			caller.contracts.updateContract({ contractId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("cancelContract rejeita contractId inválido", async () => {
		await expect(
			caller.contracts.cancelContract({ contractId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("listContracts rejeita clienteId com formato inválido", async () => {
		await expect(
			caller.contracts.listContracts({ clienteId: INVALID_UUID }),
		).rejects.toThrow();
	});
});
