import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	leadCreateInputZod,
	leadGetByIdZod,
	leadUpdateInputZod,
	listLeadsFilterZod,
} from "@connected-repo/zod-schemas/lead.zod";

const LEADS_MAX_LIMIT = 200;

export const leadsRouterTrpc = trpcRouter({
	listLeads: protectedProcedure
		.input(listLeadsFilterZod)
		.query(async ({ input }) => {
			let query = db.leads.select("*");

			if (input.status) {
				query = query.where({ status: input.status });
			}
			if (input.origem) {
				query = query.where({ origem: input.origem });
			}
			if (input.responsavelId) {
				query = query.where({ responsavelId: input.responsavelId });
			}
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"nome" ILIKE ${term}`;
			}

			return query.order({ createdAt: "DESC" }).limit(LEADS_MAX_LIMIT);
		}),

	getLeadDetail: protectedProcedure
		.input(leadGetByIdZod)
		.query(async ({ input: { leadId } }) => {
			return db.leads.find(leadId);
		}),

	createLead: protectedProcedure
		.input(leadCreateInputZod)
		.mutation(async ({ input }) => {
			return db.leads.create(input);
		}),

	updateLead: protectedProcedure
		.input(leadUpdateInputZod)
		.mutation(async ({ input: { leadId, ...data } }) => {
			return db.leads.find(leadId).update(data);
		}),

	convertLeadToClient: protectedProcedure
		.input(leadGetByIdZod)
		.mutation(async ({ input: { leadId } }) => {
			return db.$transaction(async () => {
				const lead = await db.leads.find(leadId);

				const client = await db.clients.create({
					nome: lead.nome,
					tipo: "Pessoa Física",
					email: lead.email,
					telefone: lead.telefone,
					responsavelId: lead.responsavelId,
				});

				await db.leads.find(leadId).update({
					status: "Ganho",
					convertidoClienteId: client.clientId,
				});

				return client;
			});
		}),
});
