import { db } from '@backend/db/db';
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

export const equipmentRouterTrpc = trpcRouter({
	// --- UNITS ---
	listUnitsByClient: protectedProcedure
		.input(unitsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const { teamId } = ctx.user;
			const cliente = await db.clients
				.where({ clientId: clienteId, teamId })
				.findOptional(clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.units
				.select('*')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'units.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': teamId, 'units.clienteId': clienteId })
				.order({ nome: 'ASC' });
		}),

	getUnitDetail: protectedProcedure
		.input(unitGetByIdZod)
		.query(async ({ ctx, input: { unitId } }) => {
			const { teamId } = ctx.user;
			const unit = await db.units.find(unitId);
			if (!unit) throw new Error('Unidade não encontrada');
			const cliente = await db.clients
				.where({ clientId: unit.clienteId, teamId })
				.findOptional(unit.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return unit;
		}),

	createUnit: protectedProcedure.input(unitCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		const cliente = await db.clients
			.where({ clientId: input.clienteId, teamId })
			.findOptional(input.clienteId);
		if (!cliente) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
		return db.units.create(input);
	}),

	updateUnit: protectedProcedure
		.input(unitUpdateInputZod)
		.mutation(async ({ ctx, input: { unitId, ...data } }) => {
			const { teamId } = ctx.user;
			const unit = await db.units.find(unitId);
			const cliente = await db.clients
				.where({ clientId: unit.clienteId, teamId })
				.findOptional(unit.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.units.find(unitId).update(data);
		}),

	// --- EQUIPMENT ---
	listEquipment: protectedProcedure.input(listEquipmentFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.equipment
			.select('*')
			// @ts-ignore TS2339 innerJoin not in type but exists at runtime
			.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
			.where('clients.teamId', teamId);
		if (input.clienteId) query = query.where({ 'equipment.clienteId': input.clienteId });
		if (input.unitId) query = query.where({ unitId: input.unitId });
		if (input.status) query = query.where({ status: input.status });
		if (input.ativo !== undefined) query = query.where({ ativo: input.ativo });
		return query.order({ nome: 'ASC' });
	}),

	listEquipmentByClient: protectedProcedure
		.input(equipmentsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const { teamId } = ctx.user;
			const cliente = await db.clients
				.where({ clientId: clienteId, teamId })
				.findOptional(clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.equipment
				.select('*')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': teamId, 'equipment.clienteId': clienteId })
				.order({ nome: 'ASC' });
		}),

	listEquipmentByUnit: protectedProcedure
		.input(equipmentsByUnitZod)
		.query(async ({ ctx, input: { unitId } }) => {
			const { teamId } = ctx.user;
			const unit = await db.units.find(unitId);
			if (!unit) throw new Error('Unidade não encontrada');
			const cliente = await db.clients
				.where({ clientId: unit.clienteId, teamId })
				.findOptional(unit.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.equipment.where({ unitId }).order({ nome: 'ASC' });
		}),

	getEquipmentDetail: protectedProcedure
		.input(equipmentGetByIdZod)
		.query(async ({ ctx, input: { equipmentId } }) => {
			const { teamId } = ctx.user;
			const eq = await db.equipment.find(equipmentId);
			if (!eq) throw new Error('Equipamento não encontrado');
			const cliente = await db.clients
				.where({ clientId: eq.clienteId, teamId })
				.findOptional(eq.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return eq;
		}),

	createEquipment: protectedProcedure
		.input(equipmentCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const cliente = await db.clients
				.where({ clientId: input.clienteId, teamId })
				.findOptional(input.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			const subdomain = Math.random().toString(36).substring(2, 10);
			return db.equipment.create({ ...input, subdomain });
		}),

	updateEquipment: protectedProcedure
		.input(equipmentUpdateInputZod)
		.mutation(async ({ ctx, input: { equipmentId, ...data } }) => {
			const { teamId } = ctx.user;
			const eq = await db.equipment.find(equipmentId);
			if (!eq) throw new Error('Equipamento não encontrado');
			const cliente = await db.clients
				.where({ clientId: eq.clienteId, teamId })
				.findOptional(eq.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.equipment.find(equipmentId).update(data);
		}),

	// --- RG SUBDOMAIN ---
	listEquipmentForRg: protectedProcedure.query(async ({ ctx }) => {
		// Returns active equipment with assigned sequence numbers for RG subdomain
		const { teamId } = ctx.user;
		const equipment = await db.equipment
			.select('*')
			// @ts-ignore TS2339 innerJoin not in type but exists at runtime
			.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
			.where('clients.teamId', teamId)
			.where({ ativo: true })
			.order({ sequenceNumber: 'ASC' });

		return equipment.filter((e) => e.sequenceNumber !== null);
	}),

	assignRgNumber: protectedProcedure
		.input(z.object({ equipmentId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const eq = await db.equipment.find(input.equipmentId);
			if (!eq) throw new Error('Equipamento não encontrado');
			const cliente = await db.clients
				.where({ clientId: eq.clienteId, teamId })
				.findOptional(eq.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			// Get next sequence number for this team
			const allEquipment = await db.equipment
				.select('sequenceNumber')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
				.where('clients.teamId', teamId);

			const usedNumbers = allEquipment
				.map((e) => e.sequenceNumber)
				.filter((n) => n !== null) as number[];

			let nextNumber = 1;
			while (usedNumbers.includes(nextNumber)) {
				nextNumber++;
			}

			return db.equipment.find(input.equipmentId).update({ sequenceNumber: nextNumber });
		}),
});

import { z } from 'zod';
