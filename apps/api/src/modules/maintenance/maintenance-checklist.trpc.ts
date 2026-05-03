import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const maintenanceChecklistInputZod = z.object({
	scheduleId: z.string().uuid(),
	temperaturaAmbiente: z.number().optional(),
	temperaturaInsuflada: z.number().optional(),
	pressaoSuccao: z.number().optional(),
	pressaoDescarga: z.number().optional(),
	amperagemCompressor: z.number().optional(),
	nivelGasRefrigerante: z.enum(['normal', 'baixo', 'vazio']).optional(),
	estadoFiltros: z.enum(['limpo', 'sujo', 'trocado']).optional(),
	limpezaSerpentina: z.boolean().optional(),
	funcionamentoDreno: z.boolean().optional(),
	vazamentos: z.enum(['nenhum', 'pequeno', 'grave']).optional(),
	observacoes: z.string().optional(),
});

export const maintenanceChecklistCompleteZod = maintenanceChecklistInputZod.extend({
	id: z.string().uuid(),
	photos: z.array(z.string()).optional(),
	technicianSignature: z.string().optional(),
	clientSignature: z.string().optional(),
});

// @ts-ignore TS2742 — pqb internal type inference not portable
export const maintenanceChecklistRouter = trpcRouter({
	create: protectedProcedure
		.input(maintenanceChecklistInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			if (!teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

			// IDOR FIX: Verify schedule belongs to team via plan → client
			const schedule = await db.maintenanceSchedules.findOptional(input.scheduleId);
			if (!schedule)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });

			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plano não encontrado' });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				if (!cliente || cliente.teamId !== teamId)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			}

			return db.maintenanceChecklist.create(input);
		}),

	getBySchedule: protectedProcedure
		.input(z.object({ scheduleId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			if (!teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

			// IDOR FIX: Verify schedule belongs to team
			const schedule = await db.maintenanceSchedules.findOptional(input.scheduleId);
			if (!schedule)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });

			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plano não encontrado' });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				if (!cliente || cliente.teamId !== teamId)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			}

			return db.maintenanceChecklist
				.where({ scheduleId: input.scheduleId })
				.findOptional();
		}),

	complete: protectedProcedure
		.input(maintenanceChecklistCompleteZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			if (!teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

			const checklist = await db.maintenanceChecklist.findOptional(input.id);
			if (!checklist)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist não encontrado' });

			// IDOR FIX: Verify schedule belongs to team
			const schedule = await db.maintenanceSchedules.findOptional(checklist.scheduleId);
			if (!schedule)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });

			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plano não encontrado' });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				if (!cliente || cliente.teamId !== teamId)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			}

			const { id, photos, technicianSignature, clientSignature, ...rest } = input;

			return db.maintenanceChecklist.find(id).update({
				...rest,
				photos: photos ?? [],
				technicianSignature,
				clientSignature,
				completedAt: new Date(),
			});
		}),

	listByTeam: protectedProcedure.query(async ({ ctx }) => {
		const { teamId } = ctx.user;
		if (!teamId)
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

		// Get all checklists and filter by team via schedule → plan → client
		const allChecklists = await db.maintenanceChecklist.selectAll();

		const checklistsWithTeam = await Promise.all(
			allChecklists.map(async (checklist) => {
				const schedule = await db.maintenanceSchedules.findOptional(checklist.scheduleId);
				if (!schedule) return { ...checklist, teamId: null };

				const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
				if (!plan || !plan.clienteId) return { ...checklist, teamId: null };

				const cliente = await db.clients.findOptional(plan.clienteId);
				return { ...checklist, teamId: cliente?.teamId ?? null };
			}),
		);

		return checklistsWithTeam.filter((c) => c.teamId === teamId);
	}),
});
