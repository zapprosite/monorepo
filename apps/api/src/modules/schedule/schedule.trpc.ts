import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	listScheduleFilterZod,
	scheduleCreateInputZod,
	scheduleGetByIdZod,
	scheduleUpdateInputZod,
} from "@connected-repo/zod-schemas/schedule.zod";
import z from "zod";

const SCHEDULES_MAX_LIMIT = 200;

export const scheduleRouterTrpc = trpcRouter({
	listSchedules: protectedProcedure.input(listScheduleFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.schedules
			.select("schedules.*")
			.innerJoin("clients", "schedules.clienteId", "clients.clientId")
			.where("clients.teamId", teamId);

		if (input.clienteId) {
			query = query.where({ "schedules.clienteId": input.clienteId });
		}
		if (input.tecnicoId) {
			query = query.where({ tecnicoId: input.tecnicoId });
		}
		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.tipo) {
			query = query.where({ tipo: input.tipo });
		}
		if (input.dataInicio) {
			const inicio = input.dataInicio;
			query = query.whereSql`"dataHora" >= ${inicio}::timestamptz`;
		}
		if (input.dataFim) {
			const fim = input.dataFim;
			query = query.whereSql`"dataHora" <= ${fim}::timestamptz`;
		}

		return query.order({ dataHora: "ASC" }).limit(SCHEDULES_MAX_LIMIT);
	}),

	getScheduleDetail: protectedProcedure
		.input(scheduleGetByIdZod)
		.query(async ({ ctx, input: { scheduleId } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			return schedule;
		}),

	createSchedule: protectedProcedure.input(scheduleCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		const cliente = await db.clients
			.where({ clientId: input.clienteId, teamId })
			.findOptional(input.clienteId);
		if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
		if (input.tecnicoId) {
			const tecnico = await db.users
				.where({ userId: input.tecnicoId, teamId })
				.findOptional(input.tecnicoId);
			if (!tecnico) throw new TRPCError({ code: "FORBIDDEN", message: "Técnico não pertence à equipe" });
		}
		return db.schedules.create(input);
	}),

	updateSchedule: protectedProcedure
		.input(scheduleUpdateInputZod)
		.mutation(async ({ ctx, input: { scheduleId, ...data } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			if (data.tecnicoId) {
				const tecnico = await db.users
					.where({ userId: data.tecnicoId, teamId })
					.findOptional(data.tecnicoId);
				if (!tecnico) throw new TRPCError({ code: "FORBIDDEN", message: "Técnico não pertence à equipe" });
			}

			return db.schedules.where({ scheduleId }).update(data);
		}),

	confirmarAgendamento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			return db.schedules.where({ scheduleId }).update({ status: "Confirmado" });
		}),

	iniciarAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			return db.schedules.where({ scheduleId }).update({ status: "Em Andamento" });
		}),

	concluirAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ ctx, input: { scheduleId } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			return db.schedules.where({ scheduleId }).update({ status: "Concluído" });
		}),

	cancelarAgendamento: protectedProcedure
		.input(
			z.object({
				scheduleId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input: { scheduleId, motivoCancelamento } }) => {
			const { teamId } = ctx.user;
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

			const cliente = await db.clients
				.where({ clientId: schedule.clienteId, teamId })
				.findOptional(schedule.clienteId);
			if (!cliente) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

			return db.schedules.where({ scheduleId }).update({ status: "Cancelado", motivoCancelamento: motivoCancelamento ?? null });
		}),
});
