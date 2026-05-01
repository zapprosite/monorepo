import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { clientTypeZod } from "@connected-repo/zod-schemas/crm_enums.zod";
import {
	leadCreateInputZod,
	leadGetByIdZod,
	leadUpdateInputZod,
	listLeadsFilterZod,
} from "@connected-repo/zod-schemas/lead.zod";

const LEADS_MAX_LIMIT = 200;

export const leadsRouterTrpc = trpcRouter({
	listLeads: protectedProcedure.input(listLeadsFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.leads.select("*").where({ teamId });

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

	getLeadDetail: protectedProcedure.input(leadGetByIdZod).query(async ({ ctx, input: { leadId } }) => {
		const { teamId } = ctx.user;
		const lead = await db.leads.findOptional(leadId);
		if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
		if (lead.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
		return lead;
	}),

	createLead: protectedProcedure.input(leadCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		return db.leads.create({ ...input, teamId });
	}),

	updateLead: protectedProcedure
		.input(leadUpdateInputZod)
		.mutation(async ({ ctx, input: { leadId, ...data } }) => {
			const { teamId } = ctx.user;
			const lead = await db.leads.findOptional(leadId);
			if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
			if (lead.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.leads.where({ leadId }).update(data);
		}),

	convertLeadToClient: protectedProcedure
		.input(leadGetByIdZod.extend({ tipo: clientTypeZod.optional() }))
		.mutation(async ({ ctx, input: { leadId, tipo } }) => {
			const { teamId } = ctx.user;
			return db.$transaction(async () => {
				const lead = await db.leads.findOptional(leadId);
				if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
				if (lead.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });

				const client = await db.clients.create({
					nome: lead.nome,
					tipo: tipo ?? "Pessoa Física",
					email: lead.email,
					telefone: lead.telefone,
					responsavelId: lead.responsavelId,
					teamId,
				});

				await db.leads.where({ leadId }).update({
					status: "Ganho",
					convertidoClienteId: client.clientId,
				});

				return client;
			});
		}),
});
