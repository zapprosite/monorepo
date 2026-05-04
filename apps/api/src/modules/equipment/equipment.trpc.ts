import { z } from 'zod';

import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	equipmentCreateInputZod,
	equipmentGetByIdZod,
	equipmentsByClientZod,
	equipmentsByUnitZod,
	equipmentUpdateInputZod,
	listEquipmentFilterZod,
} from '@repo/zod-schemas/equipment.zod';
import {
	unitCreateInputZod,
	unitGetByIdZod,
	unitsByClientZod,
	unitUpdateInputZod,
} from '@repo/zod-schemas/unit.zod';
import { TRPCError } from '@trpc/server';

async function assertClientTeamAccess(clienteId: string, teamId: string | null | undefined) {
	const client = await db.clients.findOptional(clienteId);
	if (!client || client.teamId !== teamId)
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
}

async function assertEquipmentTeamAccess(equipmentId: string, teamId: string | null | undefined) {
	const eq = await db.equipment.findOptional(equipmentId);
	if (!eq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Equipamento não encontrado' });
	await assertClientTeamAccess(eq.clienteId, teamId);
	return eq;
}

async function assertUnitTeamAccess(unitId: string, teamId: string | null | undefined) {
	const unit = await db.units.findOptional(unitId);
	if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unidade não encontrada' });
	await assertClientTeamAccess(unit.clienteId, teamId);
	return unit;
}

const unitsCrud = createCrudRouter({
	table: db.units,
	schemas: {
		list: unitsByClientZod,
		create: unitCreateInputZod,
		update: unitUpdateInputZod,
		delete: unitGetByIdZod,
		getById: unitGetByIdZod,
	},
	idColumn: 'unitId',
	defaultOrder: { nome: 'ASC' },
	hooks: {
		buildListQuery: (query: any, input: any, ctx: any) => {
			query = query
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'units.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': ctx.user.teamId, 'units.clienteId': input.clienteId });
			return query;
		},
		transformCreateInput: async (input: any, ctx: any) => {
			await assertClientTeamAccess(input.clienteId, ctx.user.teamId);
			return input;
		},
		onBeforeUpdate: async (input: any, ctx: any) => {
			await assertUnitTeamAccess(input.unitId, ctx.user.teamId);
		},
		onBeforeDelete: async (input: any, ctx: any) => {
			await assertUnitTeamAccess(input.unitId, ctx.user.teamId);
		},
	},
});

const equipmentCrud = createCrudRouter({
	table: db.equipment,
	schemas: {
		list: listEquipmentFilterZod,
		create: equipmentCreateInputZod,
		update: equipmentUpdateInputZod,
		delete: equipmentGetByIdZod,
		getById: equipmentGetByIdZod,
	},
	idColumn: 'equipmentId',
	defaultOrder: { nome: 'ASC' },
	hooks: {
		buildListQuery: (query: any, input: any, ctx: any) => {
			query = query
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
				.where('clients.teamId', ctx.user.teamId);
			if (input.clienteId) query = query.where({ 'equipment.clienteId': input.clienteId });
			if (input.unitId) query = query.where({ unitId: input.unitId });
			if (input.status) query = query.where({ status: input.status });
			if (input.ativo !== undefined) query = query.where({ ativo: input.ativo });
			return query;
		},
		transformCreateInput: async (input: any, ctx: any) => {
			await assertClientTeamAccess(input.clienteId, ctx.user.teamId);
			const subdomain = crypto.randomUUID().substring(0, 8);
			return { ...input, subdomain };
		},
		onBeforeUpdate: async (input: any, ctx: any) => {
			await assertEquipmentTeamAccess(input.equipmentId, ctx.user.teamId);
		},
		onBeforeDelete: async (input: any, ctx: any) => {
			await assertEquipmentTeamAccess(input.equipmentId, ctx.user.teamId);
		},
	},
});

export const equipmentRouterTrpc = trpcRouter({
	listUnitsByClient: unitsCrud.list,
	getUnitDetail: unitsCrud.getById,
	createUnit: unitsCrud.create,
	updateUnit: unitsCrud.update,
	deleteUnit: unitsCrud.delete,

	listEquipment: equipmentCrud.list,
	listEquipmentByClient: protectedProcedure
		.input(equipmentsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			await assertClientTeamAccess(clienteId, ctx.user.teamId);
			return db.equipment
				.select('*')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': ctx.user.teamId, 'equipment.clienteId': clienteId })
				.order({ nome: 'ASC' });
		}),

	listEquipmentByUnit: protectedProcedure
		.input(equipmentsByUnitZod)
		.query(async ({ ctx, input: { unitId } }) => {
			const unit = await db.units.findOptional(unitId);
			if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unidade não encontrada' });
			await assertClientTeamAccess(unit.clienteId, ctx.user.teamId);
			return db.equipment.where({ unitId }).order({ nome: 'ASC' });
		}),

	getEquipmentDetail: equipmentCrud.getById,
	createEquipment: equipmentCrud.create,
	updateEquipment: equipmentCrud.update,
	deleteEquipment: equipmentCrud.delete,

	listEquipmentForRg: protectedProcedure.query(async ({ ctx }) => {
		const equipment = await db.equipment
			.select('*')
			// @ts-ignore TS2339 innerJoin not in type but exists at runtime
			.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
			.where('clients.teamId', ctx.user.teamId)
			.where({ ativo: true })
			.order({ sequenceNumber: 'ASC' });

		return equipment.filter((e: any) => e.sequenceNumber !== null);
	}),

	assignRgNumber: protectedProcedure
		.input(z.object({ equipmentId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			await assertEquipmentTeamAccess(input.equipmentId, teamId);

			const allEquipment = await db.equipment
				.select('sequenceNumber')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
				.where('clients.teamId', teamId);

			const usedNumbers = allEquipment
				.map((e: any) => e.sequenceNumber)
				.filter((n: any) => n !== null) as number[];

			let nextNumber = 1;
			while (usedNumbers.includes(nextNumber)) {
				nextNumber++;
			}

			return db.equipment.find(input.equipmentId).update({ sequenceNumber: nextNumber });
		}),
});
