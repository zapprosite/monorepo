import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	listScheduleFilterZod,
	scheduleCreateInputZod,
	scheduleGetByIdZod,
	scheduleUpdateInputZod,
} from '@repo/zod-schemas/schedule.zod';
import { TRPCError } from '@trpc/server';
import z from 'zod';

const SCHEDULES_MAX_LIMIT = 200;

async function assertScheduleTeamAccess(scheduleId: string, teamId: string | null | undefined) {
	const schedule = await db.schedules.findOptional(scheduleId);
	if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
	const client = await db.clients.findOptional(schedule.clienteId);
	if (!client || client.teamId !== teamId)
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
	return schedule;
}

const scheduleCrud = createCrudRouter({
	table: db.schedules,
	schemas: {
		list: listScheduleFilterZod,
		create: scheduleCreateInputZod,
		update: scheduleUpdateInputZod,
		delete: scheduleGetByIdZod,
		getById: scheduleGetByIdZod,
	},
	idColumn: 'scheduleId',
	maxListLimit: SCHEDULES_MAX_LIMIT,
	defaultOrder: { dataHora: 'ASC' },
	hooks: {
		buildListQuery: (query: any, input: any, ctx: any) => {
			query = query
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'schedules.clienteId', 'clients.clientId')
				.where('clients.teamId', ctx.user.teamId);

			if (input.clienteId) query = query.where({ 'schedules.clienteId': input.clienteId });
			if (input.tecnicoId) query = query.where({ tecnicoId: input.tecnicoId });
			if (input.status) query = query.where({ status: input.status });
			if (input.tipo) query = query.where({ tipo: input.tipo });
			if (input.dataInicio) {
				query = query.whereSql`"dataHora" >= ${input.dataInicio}::timestamptz`;
			}
			if (input.dataFim) {
				query = query.whereSql`"dataHora" <= ${input.dataFim}::timestamptz`;
			}
			return query;
		},
		transformCreateInput: async (input: any, ctx: any) => {
			const client = await db.clients.findOptional(input.clienteId);
			if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (client.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			if (input.tecnicoId) {
				const tecnico = await db.users
					.where({ userId: input.tecnicoId, teamId: ctx.user.teamId })
					.findOptional(input.tecnicoId);
				if (!tecnico)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Técnico não pertence à equipe' });
			}
			return input;
		},
		onBeforeUpdate: async (input: any, ctx: any) => {
			await assertScheduleTeamAccess(input.scheduleId, ctx.user.teamId);
			if (input.tecnicoId) {
				const tecnico = await db.users
					.where({ userId: input.tecnicoId, teamId: ctx.user.teamId })
					.findOptional(input.tecnicoId);
				if (!tecnico)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Técnico não pertence à equipe' });
			}
		},
	},
});

export const scheduleRouterTrpc = trpcRouter({
	listSchedules: scheduleCrud.list,
	getScheduleDetail: scheduleCrud.getById,
	createSchedule: scheduleCrud.create,
	updateSchedule: scheduleCrud.update,

	confirmarAgendamento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			await assertScheduleTeamAccess(scheduleId, ctx.user.teamId);
			return db.schedules.where({ scheduleId }).update({ status: 'Confirmado' });
		}),

	iniciarAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			await assertScheduleTeamAccess(scheduleId, ctx.user.teamId);
			return db.schedules.where({ scheduleId }).update({ status: 'Em Andamento' });
		}),

	concluirAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			await assertScheduleTeamAccess(scheduleId, ctx.user.teamId);
			return db.schedules.where({ scheduleId }).update({ status: 'Concluído' });
		}),

	cancelarAgendamento: protectedProcedure
		.input(
			z.object({
				scheduleId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input: { scheduleId, motivoCancelamento } }) => {
			await assertScheduleTeamAccess(scheduleId, ctx.user.teamId);
			return db.schedules
				.where({ scheduleId })
				.update({ status: 'Cancelado', motivoCancelamento: motivoCancelamento ?? null });
		}),

	deleteSchedule: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			const schedule = await assertScheduleTeamAccess(scheduleId, ctx.user.teamId);
			if (schedule.status === 'Concluído' || schedule.status === 'Cancelado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Não é possível excluir agendamento com status 'Concluído' ou 'Cancelado'",
				});
			}
			return db.schedules.where({ scheduleId }).update({ status: 'Cancelado' });
		}),
});
