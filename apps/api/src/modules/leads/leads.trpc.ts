import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { clientTypeZod } from '@repo/zod-schemas/crm_enums.zod';
import {
	leadCreateInputZod,
	leadGetByIdZod,
	leadUpdateInputZod,
	listLeadsFilterZod,
} from '@repo/zod-schemas/lead.zod';
import { TRPCError } from '@trpc/server';

const LEADS_MAX_LIMIT = 200;

const leadsCrud = createCrudRouter({
	table: db.leads,
	schemas: {
		list: listLeadsFilterZod,
		create: leadCreateInputZod,
		update: leadUpdateInputZod,
		delete: leadGetByIdZod,
		getById: leadGetByIdZod,
	},
	idColumn: 'leadId',
	teamColumn: 'teamId',
	maxListLimit: LEADS_MAX_LIMIT,
	defaultOrder: { createdAt: 'DESC' },
	hooks: {
		buildListQuery: (query: any, input: any) => {
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"nome" ILIKE ${term}`;
			}
			return query;
		},
	},
});

export const leadsRouterTrpc = trpcRouter({
	listLeads: leadsCrud.list,
	getLeadDetail: leadsCrud.getById,
	createLead: leadsCrud.create,
	updateLead: leadsCrud.update,
	deleteLead: leadsCrud.delete,

	convertLeadToClient: protectedProcedure
		.input(leadGetByIdZod.extend({ tipo: clientTypeZod.optional() }))
		.mutation(async ({ ctx, input: { leadId, tipo } }) => {
			const { teamId } = ctx.user;
			return db.$transaction(async () => {
				const lead = await db.leads.findOptional(leadId);
				if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead não encontrado' });
				// @ts-ignore TS2339 teamId not in inferred type
				if (lead.teamId !== teamId)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

				// Validate responsavelId belongs to same team
				if (lead.responsavelId) {
					const responsavel = await db.users.findOptional(lead.responsavelId);
					if (!responsavel || responsavel.teamId !== teamId)
						throw new TRPCError({ code: 'FORBIDDEN', message: 'Responsável de outro time' });
				}

				const client = await db.clients.create({
					nome: lead.nome,
					tipo: tipo ?? 'Pessoa Física',
					email: lead.email,
					telefone: lead.telefone,
					responsavelId: lead.responsavelId,
					teamId,
				});

				await db.leads.where({ leadId }).update({
					status: 'Ganho',
					convertidoClienteId: client.clientId,
				});

				return client;
			});
		}),
});
