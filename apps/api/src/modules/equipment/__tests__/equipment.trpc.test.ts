import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

// Valid UUIDs (not real, but structurally valid)
const FAKE_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const FAKE_UUID_2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const FAKE_UUID_3 = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("equipment — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listUnitsByClient rejeita não autenticado", async () => {
		await expect(
			caller.equipment.listUnitsByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("getUnitDetail rejeita não autenticado", async () => {
		await expect(
			caller.equipment.getUnitDetail({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createUnit rejeita não autenticado", async () => {
		await expect(
			caller.equipment.createUnit({
				clienteId: FAKE_UUID,
				nome: "Unidade A",
				tipo: "Residencial",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateUnit rejeita não autenticado", async () => {
		await expect(
			caller.equipment.updateUnit({ unitId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("listEquipment rejeita não autenticado", async () => {
		await expect(caller.equipment.listEquipment({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("listEquipmentByClient rejeita não autenticado", async () => {
		await expect(
			caller.equipment.listEquipmentByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("listEquipmentByUnit rejeita não autenticado", async () => {
		await expect(
			caller.equipment.listEquipmentByUnit({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("getEquipmentDetail rejeita não autenticado", async () => {
		await expect(
			caller.equipment.getEquipmentDetail({ equipmentId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createEquipment rejeita não autenticado", async () => {
		await expect(
			caller.equipment.createEquipment({
				clienteId: FAKE_UUID,
				nome: "Equipamento Teste",
				tipo: "ar-condicionado",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateEquipment rejeita não autenticado", async () => {
		await expect(
			caller.equipment.updateEquipment({ equipmentId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// listUnitsByClient — team isolation + filtros
// ---------------------------------------------------------------------------
describe("equipment — listUnitsByClient IDOR protection", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("listUnitsByClient lança FORBIDDEN para cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.listUnitsByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("listUnitsByClient lança FORBIDDEN para cliente inexistente", async () => {
		// Cliente não existe → team check fails → FORBIDDEN
		await expect(
			caller.equipment.listUnitsByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

// ---------------------------------------------------------------------------
// getUnitDetail — NOT_FOUND
// ---------------------------------------------------------------------------
describe("equipment — getUnitDetail validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getUnitDetail lança NOT_FOUND para unit inexistente", async () => {
		await expect(
			caller.equipment.getUnitDetail({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("getUnitDetail lança FORBIDDEN para unit de cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.getUnitDetail({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("getUnitDetail lança erro para UUID inválido", async () => {
		await expect(
			caller.equipment.getUnitDetail({ unitId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createUnit — validação de input + team isolation
// ---------------------------------------------------------------------------
describe("equipment — createUnit validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("createUnit lança NOT_FOUND para cliente inexistente", async () => {
		await expect(
			caller.equipment.createUnit({
				clienteId: FAKE_UUID,
				nome: "Unidade Teste",
				tipo: "Residencial",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("createUnit lança FORBIDDEN para cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.createUnit({
				clienteId: FAKE_UUID,
				nome: "Unidade Teste",
				tipo: "Residencial",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("createUnit lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.equipment.createUnit({
				clienteId: "not-a-uuid",
				nome: "Unidade Teste",
				tipo: "Residencial",
			}),
		).rejects.toThrow();
	});

	it("createUnit lança erro para nome vazio", async () => {
		await expect(
			caller.equipment.createUnit({
				clienteId: FAKE_UUID,
				nome: "",
				tipo: "Residencial",
			}),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// updateUnit — NOT_FOUND + team isolation
// ---------------------------------------------------------------------------
describe("equipment — updateUnit validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("updateUnit lança NOT_FOUND para unit inexistente", async () => {
		await expect(
			caller.equipment.updateUnit({ unitId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("updateUnit lança FORBIDDEN para unit de cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.updateUnit({ unitId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("updateUnit lança erro para UUID inválido", async () => {
		await expect(
			caller.equipment.updateUnit({ unitId: "not-a-uuid", nome: "Updated" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// listEquipment — filtros + team isolation
// ---------------------------------------------------------------------------
describe("equipment — listEquipment filters", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("listEquipment sem filtros retorna array", async () => {
		const result = await caller.equipment.listEquipment({});
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment com filtro clienteId retorna array", async () => {
		const result = await caller.equipment.listEquipment({ clienteId: FAKE_UUID });
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment com filtro unitId retorna array", async () => {
		const result = await caller.equipment.listEquipment({ unitId: FAKE_UUID });
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment com filtro status retorna array", async () => {
		const result = await caller.equipment.listEquipment({ status: "Ativo" });
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment com filtro ativo=true retorna array", async () => {
		const result = await caller.equipment.listEquipment({ ativo: true });
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment com filtro ativo=false retorna array", async () => {
		const result = await caller.equipment.listEquipment({ ativo: false });
		expect(result).toBeInstanceOf(Array);
	});

	it("listEquipment combina filtros múltiplos", async () => {
		const result = await caller.equipment.listEquipment({
			status: "Ativo",
			ativo: true,
			clienteId: FAKE_UUID,
		});
		expect(result).toBeInstanceOf(Array);
	});
});

// ---------------------------------------------------------------------------
// listEquipmentByClient — team isolation
// ---------------------------------------------------------------------------
describe("equipment — listEquipmentByClient IDOR protection", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("listEquipmentByClient lança FORBIDDEN para cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.listEquipmentByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("listEquipmentByClient lança FORBIDDEN para cliente inexistente", async () => {
		await expect(
			caller.equipment.listEquipmentByClient({ clienteId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

// ---------------------------------------------------------------------------
// listEquipmentByUnit — team isolation
// ---------------------------------------------------------------------------
describe("equipment — listEquipmentByUnit validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("listEquipmentByUnit lança NOT_FOUND para unit inexistente", async () => {
		await expect(
			caller.equipment.listEquipmentByUnit({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("listEquipmentByUnit lança FORBIDDEN para unit de cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.listEquipmentByUnit({ unitId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("listEquipmentByUnit lança erro para UUID inválido", async () => {
		await expect(
			caller.equipment.listEquipmentByUnit({ unitId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getEquipmentDetail — NOT_FOUND
// ---------------------------------------------------------------------------
describe("equipment — getEquipmentDetail validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("getEquipmentDetail lança NOT_FOUND para equipment inexistente", async () => {
		await expect(
			caller.equipment.getEquipmentDetail({ equipmentId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("getEquipmentDetail lança FORBIDDEN para equipment de cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.getEquipmentDetail({ equipmentId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("getEquipmentDetail lança erro para UUID inválido", async () => {
		await expect(
			caller.equipment.getEquipmentDetail({ equipmentId: "not-a-uuid" }),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createEquipment — team isolation
// ---------------------------------------------------------------------------
describe("equipment — createEquipment validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("createEquipment lança FORBIDDEN para cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.createEquipment({
				clienteId: FAKE_UUID,
				nome: "Equipamento Teste",
				tipo: "ar-condicionado",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("createEquipment lança FORBIDDEN para cliente inexistente", async () => {
		await expect(
			caller.equipment.createEquipment({
				clienteId: FAKE_UUID,
				nome: "Equipamento Teste",
				tipo: "ar-condicionado",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("createEquipment lança erro para UUID inválido em clienteId", async () => {
		await expect(
			caller.equipment.createEquipment({
				clienteId: "not-a-uuid",
				nome: "Equipamento Teste",
				tipo: "ar-condicionado",
			}),
		).rejects.toThrow();
	});

	it("createEquipment lança erro para nome vazio", async () => {
		await expect(
			caller.equipment.createEquipment({
				clienteId: FAKE_UUID,
				nome: "",
				tipo: "ar-condicionado",
			}),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// updateEquipment — NOT_FOUND + team isolation
// ---------------------------------------------------------------------------
describe("equipment — updateEquipment validation", () => {
	const caller = createCaller(authContext({ teamId: "team-01" }));

	it("updateEquipment lança NOT_FOUND para equipment inexistente", async () => {
		await expect(
			caller.equipment.updateEquipment({ equipmentId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("updateEquipment lança FORBIDDEN para equipment de cliente de outro team", async () => {
		const callerOtherTeam = createCaller(authContext({ teamId: "team-other" }));
		await expect(
			callerOtherTeam.equipment.updateEquipment({ equipmentId: FAKE_UUID, nome: "Updated" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("updateEquipment lança erro para UUID inválido", async () => {
		await expect(
			caller.equipment.updateEquipment({ equipmentId: "not-a-uuid", nome: "Updated" }),
		).rejects.toThrow();
	});
});
