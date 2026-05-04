import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	listReminderFilterZod,
	reminderCreateInputZod,
	reminderGetByIdZod,
	reminderUpdateInputZod,
} from '@repo/zod-schemas/reminder.zod';
import { TRPCError } from '@trpc/server';

const REMINDERS_MAX_LIMIT = 500;

async function assertReminderTeamAccess(reminderId: string, teamId: string | null | undefined) {
	const reminder = await db.reminders.findOptional(reminderId);
	if (!reminder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lembrete não encontrado' });
	const client = await db.clients.findOptional(reminder.clienteId);
	if (!client || client.teamId !== teamId)
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
	return reminder;
}

const remindersCrud = createCrudRouter({
	table: db.reminders,
	schemas: {
		list: listReminderFilterZod,
		create: reminderCreateInputZod,
		update: reminderUpdateInputZod,
		delete: reminderGetByIdZod,
		getById: reminderGetByIdZod,
	},
	idColumn: 'reminderId',
	maxListLimit: REMINDERS_MAX_LIMIT,
	defaultOrder: { dataLembrete: 'ASC' },
	hooks: {
		buildListQuery: (query: any, input: any, ctx: any) => {
			query = query
				// @ts-ignore join signature mismatch at runtime
				.join('clients', 'reminders.clienteId', 'clients.clientId')
				.where({ 'clients.teamId': ctx.user.teamId });

			if (input.clienteId) query = query.where({ clienteId: input.clienteId });
			if (input.status) query = query.where({ status: input.status });
			if (input.tipo) query = query.where({ tipo: input.tipo });
			if (input.dataInicio) {
				query = query.whereSql`"dataLembrete" >= ${input.dataInicio}::date`;
			}
			if (input.dataFim) {
				query = query.whereSql`"dataLembrete" <= ${input.dataFim}::date`;
			}
			return query;
		},
		transformCreateInput: async (input: any, ctx: any) => {
			const client = await db.clients.findOptional(input.clienteId);
			if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (client.teamId !== ctx.user.teamId)
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return input;
		},
		onBeforeUpdate: async (input: any, ctx: any) => {
			await assertReminderTeamAccess(input.reminderId, ctx.user.teamId);
		},
		transformGetByIdResult: async (item: any, _ctx: any) => {
			const client = await db.clients.findOptional(item.clienteId);
			return { ...item, clienteNome: client?.nome ?? null };
		},
		transformListResult: async (items: any[], _input: any, _ctx: any) => {
			if (items.length === 0) return [];
			const clientIds = [...new Set(items.map((r) => r.clienteId))];
			const clients = await db.clients
				.where({ clientId: { in: clientIds } })
				.select('clientId', 'nome');
			const clientMap = new Map(clients.map((c) => [c.clientId, c.nome]));
			return items.map((r) => ({ ...r, clienteNome: clientMap.get(r.clienteId) ?? null }));
		},
	},
});

export const remindersRouterTrpc = trpcRouter({
	listReminders: remindersCrud.list,
	getReminderDetail: remindersCrud.getById,
	createReminder: remindersCrud.create,
	updateReminder: remindersCrud.update,

	deleteReminder: protectedProcedure
		.input(reminderGetByIdZod)
		.mutation(async ({ ctx, input: { reminderId } }) => {
			const reminder = await assertReminderTeamAccess(reminderId, ctx.user.teamId);
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
			await assertReminderTeamAccess(reminderId, ctx.user.teamId);
			return db.reminders.where({ reminderId }).update({ status: 'Concluído' });
		}),

	cancelReminder: protectedProcedure
		.input(reminderGetByIdZod)
		.mutation(async ({ ctx, input: { reminderId } }) => {
			await assertReminderTeamAccess(reminderId, ctx.user.teamId);
			return db.reminders.where({ reminderId }).update({ status: 'Cancelado' });
		}),
});
