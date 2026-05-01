import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	addressCreateInputZod,
	addressesByClientZod,
} from "@connected-repo/zod-schemas/address.zod";
import {
	clientCreateInputZod,
	clientGetByIdZod,
	clientUpdateInputZod,
	listClientsFilterZod,
} from "@connected-repo/zod-schemas/client.zod";
import {
	contactCreateInputZod,
	contactsByClientZod,
} from "@connected-repo/zod-schemas/contact.zod";
import z from "zod";

const CLIENTS_MAX_LIMIT = 200;
const RELATED_MAX_LIMIT = 100;

// Helper: extract teamId from authenticated user context
// NOTE: ctx.user.teamId requires SessionUser to include teamId
// and CRM tables (clients, leads, contacts, addresses, etc.) must have teamId column
const getTeamId = (ctx: { user: { teamId?: string } }) => {
	const teamId = ctx.user.teamId;
	if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Team não encontrado no contexto" });
	return teamId;
};

export const clientsRouterTrpc = trpcRouter({
	listClients: protectedProcedure.input(listClientsFilterZod).query(async ({ ctx, input }) => {
		const teamId = getTeamId(ctx);
		let query = db.clients.select("*").where({ teamId });

		if (input.tipo) {
			query = query.where({ tipo: input.tipo });
		}
		if (input.responsavelId) {
			query = query.where({ responsavelId: input.responsavelId });
		}
		if (input.ativo !== undefined) {
			query = query.where({ ativo: input.ativo });
		}
		if (input.search) {
			const term = `%${input.search}%`;
			query = query.whereSql`"nome" ILIKE ${term}`;
		}

		return query.order({ nome: "ASC" }).limit(CLIENTS_MAX_LIMIT);
	}),

	getClientDetail: protectedProcedure
		.input(clientGetByIdZod)
		.query(async ({ ctx, input: { clientId } }) => {
			const teamId = getTeamId(ctx);
			const client = await db.clients.findOptional(clientId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return client;
		}),

	createClient: protectedProcedure.input(clientCreateInputZod).mutation(async ({ ctx, input }) => {
		const teamId = getTeamId(ctx);
		return db.clients.create({ ...input, teamId });
	}),

	updateClient: protectedProcedure
		.input(clientUpdateInputZod)
		.mutation(async ({ ctx, input: { clientId, ...data } }) => {
			const teamId = getTeamId(ctx);
			const client = await db.clients.findOptional(clientId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.clients.where({ clientId }).update(data);
		}),

	addContact: protectedProcedure.input(contactCreateInputZod).mutation(async ({ ctx, input }) => {
		const teamId = getTeamId(ctx);
		// IDOR fix: verify client belongs to team before adding contact
		const client = await db.clients.findOptional(input.clienteId);
		if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
		if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
		return db.contacts.create(input);
	}),

	listContacts: protectedProcedure
		.input(contactsByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const teamId = getTeamId(ctx);
			// IDOR fix: verify client belongs to team before listing contacts
			const client = await db.clients.findOptional(clienteId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.contacts
				.where({ clienteId })
				.order({ isPrimary: "DESC", nome: "ASC" })
				.limit(RELATED_MAX_LIMIT);
		}),

	updateContact: protectedProcedure
		.input(contactCreateInputZod.omit({ clienteId: true }).extend({ contactId: z.string().uuid() }))
		.mutation(async ({ ctx, input: { contactId, ...data } }) => {
			const teamId = getTeamId(ctx);
			const contact = await db.contacts.findOptional(contactId);
			if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
			// IDOR fix: verify client's team matches before updating contact
			const client = await db.clients.findOptional(contact.clienteId);
			if (!client || client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.contacts.where({ contactId }).update(data);
		}),

	addAddress: protectedProcedure.input(addressCreateInputZod).mutation(async ({ ctx, input }) => {
		const teamId = getTeamId(ctx);
		// IDOR fix: verify client belongs to team before adding address
		const client = await db.clients.findOptional(input.clienteId);
		if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
		if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
		return db.addresses.create(input);
	}),

	listAddresses: protectedProcedure
		.input(addressesByClientZod)
		.query(async ({ ctx, input: { clienteId } }) => {
			const teamId = getTeamId(ctx);
			// IDOR fix: verify client belongs to team before listing addresses
			const client = await db.clients.findOptional(clienteId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.addresses.where({ clienteId }).limit(RELATED_MAX_LIMIT);
		}),

	updateAddress: protectedProcedure
		.input(addressCreateInputZod.omit({ clienteId: true }).extend({ addressId: z.string().uuid() }))
		.mutation(async ({ ctx, input: { addressId, ...data } }) => {
			const teamId = getTeamId(ctx);
			const address = await db.addresses.findOptional(addressId);
			if (!address) throw new TRPCError({ code: "NOT_FOUND", message: "Endereço não encontrado" });
			// IDOR fix: verify client's team matches before updating address
			const client = await db.clients.findOptional(address.clienteId);
			if (!client || client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.addresses.where({ addressId }).update(data);
		}),
});
