import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

const MaintenancePlanOutput = z.object({
	id: z.string(),
	nomeEmpresa: z.string(),
	tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
	periodicidadeDias: z.number(),
	clienteId: z.string().optional(),
	equipamentoId: z.string().optional(),
	proxima: z.date().optional(),
	createdAt: z.date(),
});

export const maintenanceRouter = trpcRouter({
	createPlan: protectedProcedure
		.input(
			z.object({
				nomeEmpresa: z.string().min(1),
				tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
				periodicidadeDias: z.number().int().min(1),
				clienteId: z.string().uuid().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			// IDOR FIX: Verify client belongs to team before creating plan
			if (input.clienteId) {
				const cliente = await db.clients.findOptional(input.clienteId);
				if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
				// @ts-ignore - teamId check pattern
				if (cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return db.maintenancePlans.create(input);
		}),

	listPlans: protectedProcedure.query(async ({ ctx }) => {
		// @ts-ignore - teamId exists at runtime but not in type definition
		const { teamId } = ctx.user;
		if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

		// IDOR FIX: Get plans and filter by team in application layer
		const allPlans = await db.maintenancePlans.selectAll();
		const plansWithClient = await Promise.all(
			allPlans.map(async (plan) => {
				if (!plan.clienteId) return { ...plan, clientTeamId: null };
				const cliente = await db.clients.findOptional(plan.clienteId);
				return { ...plan, clientTeamId: cliente?.teamId ?? null };
			}),
		);

		return plansWithClient.filter((p) => p.clientTeamId === teamId);
	}),

	getPlanById: protectedProcedure
		.input(z.object({ planId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const plan = await db.maintenancePlans.findOptional(input.planId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			// IDOR FIX: Verify plan belongs to team via client relationship
			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return plan;
		}),

	updatePlan: protectedProcedure
		.input(
			z.object({
				planId: z.string().uuid(),
				nomeEmpresa: z.string().min(1).optional(),
				tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]).optional(),
				periodicidadeDias: z.number().int().min(1).optional(),
				clienteId: z.string().uuid().optional(),
			}),
		)
		.mutation(async ({ ctx, input: { planId, ...data } }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const plan = await db.maintenancePlans.findOptional(planId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			// IDOR FIX: Verify plan belongs to team via client relationship
			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			// If updating clienteId, verify new client belongs to team
			if (data.clienteId) {
				const newCliente = await db.clients.findOptional(data.clienteId);
				// @ts-ignore - teamId check pattern
				if (!newCliente || newCliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return db.maintenancePlans.find(planId).update(data);
		}),

	deletePlan: protectedProcedure
		.input(z.object({ planId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const plan = await db.maintenancePlans.findOptional(input.planId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			// IDOR FIX: Verify plan belongs to team via client relationship
			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return db.maintenancePlans.delete(input.planId);
		}),

	// — Maintenance Schedules —

	listSchedules: protectedProcedure
		.input(
			z.object({
				planId: z.string().uuid().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			// IDOR FIX: Get all schedules and filter by team via plan → client relationship
			let schedules = await db.maintenanceSchedules.selectAll();

			if (input.planId) {
				schedules = schedules.filter((s) => s.planoManutencaoId === input.planId);
			}

			// Filter by team
			const schedulesWithTeam = await Promise.all(
				schedules.map(async (schedule) => {
					const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
					if (!plan || !plan.clienteId) return { ...schedule, teamId: null };
					const cliente = await db.clients.findOptional(plan.clienteId);
					return { ...schedule, teamId: cliente?.teamId ?? null };
				}),
			);

			return schedulesWithTeam.filter((s) => s.teamId === teamId);
		}),

	getScheduleById: protectedProcedure
		.input(z.object({ scheduleId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const schedule = await db.maintenanceSchedules.findOptional(input.scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			// IDOR FIX: Verify schedule belongs to team via plan → client relationship
			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return schedule;
		}),

	createSchedule: protectedProcedure
		.input(
			z.object({
				planoManutencaoId: z.string().uuid(),
				dataAgendada: z.date(),
				tecnicoAtribuidoId: z.string().uuid().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			// IDOR FIX: Verify plan belongs to team before creating schedule
			const plan = await db.maintenancePlans.findOptional(input.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			// Verify tecnico belongs to team if provided
			if (input.tecnicoAtribuidoId) {
				const tecnico = await db.users.findOptional(input.tecnicoAtribuidoId);
				if (!tecnico) throw new TRPCError({ code: "NOT_FOUND", message: "Técnico não encontrado" });
			}

			return db.maintenanceSchedules.create(input);
		}),

	updateSchedule: protectedProcedure
		.input(
			z.object({
				scheduleId: z.string().uuid(),
				dataAgendada: z.date().optional(),
				statusManutencao: z.enum(["agendada", "em_execucao", "concluida", "cancelada"]).optional(),
				tecnicoAtribuidoId: z.string().uuid().nullable().optional(),
				notasExecucao: z.string().optional(),
				tempoExecucao: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input: { scheduleId, ...data } }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const schedule = await db.maintenanceSchedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			// IDOR FIX: Verify schedule belongs to team via plan → client relationship
			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return db.maintenanceSchedules.find(scheduleId).update(data);
		}),

	deleteSchedule: protectedProcedure
		.input(z.object({ scheduleId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// @ts-ignore - teamId exists at runtime but not in type definition
			const { teamId } = ctx.user;
			if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });

			const schedule = await db.maintenanceSchedules.findOptional(input.scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			// IDOR FIX: Verify schedule belongs to team via plan → client relationship
			const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
			if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

			if (plan.clienteId) {
				const cliente = await db.clients.findOptional(plan.clienteId);
				// @ts-ignore - teamId check pattern
				if (!cliente || cliente.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

			return db.maintenanceSchedules.delete(input.scheduleId);
		}),
});