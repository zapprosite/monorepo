import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	equipmentCreateInputZod,
	equipmentGetByIdZod,
	equipmentsByClientZod,
	equipmentsByUnitZod,
	equipmentUpdateInputZod,
	listEquipmentFilterZod,
} from "@connected-repo/zod-schemas/equipment.zod";
import {
	unitCreateInputZod,
	unitGetByIdZod,
	unitsByClientZod,
	unitUpdateInputZod,
} from "@connected-repo/zod-schemas/unit.zod";

export const equipmentRouterTrpc = trpcRouter({
	// --- UNITS ---
	listUnitsByClient: protectedProcedure
		.input(unitsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const { teamId } = ctx.user;
			return db.units.select("units.*").innerJoin("clients", "units.clienteId", "clients.clientId").where("clients.teamId", teamId).order({ nome: "ASC" });
		}),

	getUnitDetail: protectedProcedure.input(unitGetByIdZod).query(async ({ ctx, input: { unitId } }) => {
		const { teamId } = ctx.user;
		const unit = await db.units.find(unitId);
		if (!unit) throw new Error("Unidade não encontrada");
		const cliente = await db.clients.where({ clientId: unit.clienteId, teamId }).findOptional(unit.clienteId);
		if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
		return unit;
	}),

	createUnit: protectedProcedure.input(unitCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		const cliente = await db.clients.where({ clientId: input.clienteId, teamId }).findOptional(input.clienteId);
		if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
		return db.units.create(input);
	}),

	updateUnit: protectedProcedure
		.input(unitUpdateInputZod)
		.mutation(async ({ ctx, input: { unitId, ...data } }) => {
			const { teamId } = ctx.user;
			const unit = await db.units.find(unitId);
			const cliente = await db.clients.where({ clientId: unit.clienteId, teamId }).findOptional(unit.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.units.find(unitId).update(data);
		}),

	// --- EQUIPMENT ---
	listEquipment: protectedProcedure.input(listEquipmentFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.equipment.select("equipment.*").innerJoin("clients", "equipment.clienteId", "clients.clientId").where("clients.teamId", teamId);
		if (input.clienteId) query = query.where({ "equipment.clienteId": input.clienteId });
		if (input.unitId) query = query.where({ unitId: input.unitId });
		if (input.status) query = query.where({ status: input.status });
		if (input.ativo !== undefined) query = query.where({ ativo: input.ativo });
		return query.order({ nome: "ASC" });
	}),

	listEquipmentByClient: protectedProcedure
		.input(equipmentsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const { teamId } = ctx.user;
			return db.equipment.select("equipment.*").innerJoin("clients", "equipment.clienteId", "clients.clientId").where("clients.teamId", teamId).order({ nome: "ASC" });
		}),

	listEquipmentByUnit: protectedProcedure
		.input(equipmentsByUnitZod)
		.query(async ({ ctx, input: { unitId } }) => {
			const { teamId } = ctx.user;
			return db.equipment.where({ unitId }).order({ nome: "ASC" });
		}),

	getEquipmentDetail: protectedProcedure
		.input(equipmentGetByIdZod)
		.query(async ({ input: { equipmentId } }) => {
			const eq = await db.equipment.find(equipmentId);
			if (!eq) throw new Error("Equipamento não encontrado");
			return eq;
		}),

	createEquipment: protectedProcedure.input(equipmentCreateInputZod).mutation(async ({ input }) => {
		return db.equipment.create(input);
	}),

	updateEquipment: protectedProcedure
		.input(equipmentUpdateInputZod)
		.mutation(async ({ input: { equipmentId, ...data } }) => {
			return db.equipment.find(equipmentId).update(data);
		}),
});
