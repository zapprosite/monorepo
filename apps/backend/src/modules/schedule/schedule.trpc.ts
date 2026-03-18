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
	listSchedules: protectedProcedure
		.input(listScheduleFilterZod)
		.query(async ({ input }) => {
			let query = db.schedules.select("*");

			if (input.clienteId) {
				query = query.where({ clienteId: input.clienteId });
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
		.query(async ({ input: { scheduleId } }) => {
			const schedule = await db.schedules.findOptional(scheduleId);
			if (!schedule) throw new Error("Agendamento não encontrado");
			return schedule;
		}),

	createSchedule: protectedProcedure
		.input(scheduleCreateInputZod)
		.mutation(async ({ input }) => {
			return db.schedules.create(input);
		}),

	updateSchedule: protectedProcedure
		.input(scheduleUpdateInputZod)
		.mutation(async ({ input: { scheduleId, ...data } }) => {
			return db.schedules.find(scheduleId).update(data);
		}),

	confirmarAgendamento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ input: { scheduleId } }) => {
			return db.schedules.find(scheduleId).update({ status: "Confirmado" });
		}),

	iniciarAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ input: { scheduleId } }) => {
			return db.schedules.find(scheduleId).update({ status: "Em Andamento" });
		}),

	concluirAtendimento: protectedProcedure
		.input(scheduleGetByIdZod)
		.mutation(async ({ input: { scheduleId } }) => {
			return db.schedules.find(scheduleId).update({ status: "Concluído" });
		}),

	cancelarAgendamento: protectedProcedure
		.input(
			z.object({
				scheduleId: z.string().uuid(),
				motivoCancelamento: z.string().optional(),
			}),
		)
		.mutation(async ({ input: { scheduleId, motivoCancelamento } }) => {
			return db.schedules
				.find(scheduleId)
				.update({ status: "Cancelado", motivoCancelamento: motivoCancelamento ?? null });
		}),
});
