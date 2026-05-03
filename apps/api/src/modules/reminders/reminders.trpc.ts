import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	listReminderFilterZod,
	reminderCreateInputZod,
	reminderGetByIdZod,
	reminderUpdateInputZod,
} from '@repo/zod-schemas/reminder.zod';
import { TRPCError } from '@trpc/server';

const REMINDERS_MAX_LIMIT = 500;

export const remindersRouterTrpc = trpcRouter({
	listReminders: protectedProcedure.input(listReminderFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.reminders
			.join('clients', 'reminders.clienteId', 'clients.clientId')
			.where({ 'clients.teamId': teamId });

		if (input.clienteId) {
			query = query.where({ clienteId: input.clienteId });
		}
		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.tipo) {
			query = query.where({ tipo: input.tipo });
		}
		if (input.dataInicio) {
			const inicio = input.dataInicio;
			query = query.whereSql`"dataLembrete" >= ${inicio}::date`;
		}
		if (input.dataFim) {
			const fim = input.dataFim;
			query = query.whereSql`"dataLembrete" <= ${fim}::date`;
		}

		const reminders = await query.order({ dataLembrete: 'ASC' }).limit(REMINDERS_MAX_LIMIT);

		if (reminders.length === 0) return [];

		const clientIds = [...new Set(reminders.map((r) => r.clienteId))];
		const clients = await db.clients
			.where({ clientId: { in: clientIds } })
			.select('clientId', 'nome');

		const clientMap = new Map(clients.map((c) => [c.clientId, c.nome]));

		return reminders.map((r) => ({
			...r,
			clienteNome: clientMap.get(r.clienteId) ?? null,
		}));
	}),

	getReminderDetail: protectedProcedure
		.input(reminderGetByIdZod)
		.query(async ({ ctx, input: { reminderId } }) => {
			const { teamId } = ctx.user;
			const reminder = await db.reminders.findOptional(reminderId);
			if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });

			const client = await db.clients.findOptional(reminder.clienteId);
			if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			return {
				...reminder,
				clienteNome: client.nome,
			};
		}),

	createReminder: protectedProcedure
		.input(reminderCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const client = await db.clients.findOptional(input.clienteId);
			if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.reminders.create(input);
		}),

	updateReminder: protectedProcedure
		.input(reminderUpdateInputZod)
		.mutation(async ({ ctx, input: { reminderId, ...data } }) => {
			const { teamId } = ctx.user;
			const reminder = await db.reminders.findOptional(reminderId);
			if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });

			const client = await db.clients.findOptional(reminder.clienteId);
			if (!client || client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			return db.reminders.where({ reminderId }).update(data);
		}),

	deleteReminder: protectedProcedure
		.input(reminderGetByIdZod)
		.mutation(async ({ ctx, input: { reminderId } }) => {
			const { teamId } = ctx.user;
			const reminder = await db.reminders.findOptional(reminderId);
			if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });

			const client = await db.clients.findOptional(reminder.clienteId);
			if (!client || client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			if (reminder.status === 'Concluído' || reminder.status === 'Cancelado') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Não é possível excluir lembrete com status 'Concluído' ou 'Cancelado'",
				});
			}
			return db.reminders.where({ reminderId }).update({ status: 'Cancelado' });
		}),

	completeReminder: protectedProcedure
		.input(reminderGetByIdZod)
		.mutation(async ({ ctx, input: { reminderId } }) => {
			const { teamId } = ctx.user;
			const reminder = await db.reminders.findOptional(reminderId);
			if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });

			const client = await db.clients.findOptional(reminder.clienteId);
			if (!client || client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			return db.reminders.where({ reminderId }).update({ status: 'Concluído' });
		}),

	cancelReminder: protectedProcedure
		.input(reminderGetByIdZod)
		.mutation(async ({ ctx, input: { reminderId } }) => {
			const { teamId } = ctx.user;
			const reminder = await db.reminders.findOptional(reminderId);
			if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });

			const client = await db.clients.findOptional(reminder.clienteId);
			if (!client || client.teamId !== teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			return db.reminders.where({ reminderId }).update({ status: 'Cancelado' });
		}),
});
