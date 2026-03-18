import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	equipmentCreateInputZod,
	equipmentGetByIdZod,
	equipmentUpdateInputZod,
	equipmentsByClientZod,
	equipmentsByUnitZod,
	listEquipmentFilterZod,
} from "@connected-repo/zod-schemas/equipment.zod";
import {
	unitCreateInputZod,
	unitGetByIdZod,
	unitUpdateInputZod,
	unitsByClientZod,
} from "@connected-repo/zod-schemas/unit.zod";

export const equipmentRouterTrpc = trpcRouter({
	// --- UNITS ---
	listUnitsByClient: protectedProcedure
		.input(unitsByClientZod)
		.query(async ({ input: { clienteId } }) => {
			return db.units.where({ clienteId }).order({ nome: "ASC" });
		}),

	getUnitDetail: protectedProcedure
		.input(unitGetByIdZod)
		.query(async ({ input: { unitId } }) => {
			const unit = await db.units.find(unitId);
			if (!unit) throw new Error("Unidade não encontrada");
			return unit;
		}),

	createUnit: protectedProcedure
		.input(unitCreateInputZod)
		.mutation(async ({ input }) => {
			return db.units.create(input);
		}),

	updateUnit: protectedProcedure
		.input(unitUpdateInputZod)
		.mutation(async ({ input: { unitId, ...data } }) => {
			return db.units.find(unitId).update(data);
		}),

	// --- EQUIPMENT ---
	listEquipment: protectedProcedure
		.input(listEquipmentFilterZod)
		.query(async ({ input }) => {
			let query = db.equipment.select("*");
			if (input.clienteId) query = query.where({ clienteId: input.clienteId });
			if (input.unitId) query = query.where({ unitId: input.unitId });
			if (input.status) query = query.where({ status: input.status });
			if (input.ativo !== undefined) query = query.where({ ativo: input.ativo });
			return query.order({ nome: "ASC" });
		}),

	listEquipmentByClient: protectedProcedure
		.input(equipmentsByClientZod)
		.query(async ({ input: { clienteId } }) => {
			return db.equipment.where({ clienteId }).order({ nome: "ASC" });
		}),

	listEquipmentByUnit: protectedProcedure
		.input(equipmentsByUnitZod)
		.query(async ({ input: { unitId } }) => {
			return db.equipment.where({ unitId }).order({ nome: "ASC" });
		}),

	getEquipmentDetail: protectedProcedure
		.input(equipmentGetByIdZod)
		.query(async ({ input: { equipmentId } }) => {
			const eq = await db.equipment.find(equipmentId);
			if (!eq) throw new Error("Equipamento não encontrado");
			return eq;
		}),

	createEquipment: protectedProcedure
		.input(equipmentCreateInputZod)
		.mutation(async ({ input }) => {
			return db.equipment.create(input);
		}),

	updateEquipment: protectedProcedure
		.input(equipmentUpdateInputZod)
		.mutation(async ({ input: { equipmentId, ...data } }) => {
			return db.equipment.find(equipmentId).update(data);
		}),
});
