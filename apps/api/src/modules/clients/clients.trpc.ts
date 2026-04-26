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

export const clientsRouterTrpc = trpcRouter({
	listClients: protectedProcedure.input(listClientsFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
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
			const { teamId } = ctx.user;
			const client = await db.clients.findOptional(clientId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return client;
		}),

	createClient: protectedProcedure.input(clientCreateInputZod).mutation(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		return db.clients.create({ ...input, teamId });
	}),

	updateClient: protectedProcedure
		.input(clientUpdateInputZod)
		.mutation(async ({ ctx, input: { clientId, ...data } }) => {
			const { teamId } = ctx.user;
			const client = await db.clients.findOptional(clientId);
			if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
			if (client.teamId !== teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			return db.clients.where({ clientId }).update(data);
		}),

	addContact: protectedProcedure.input(contactCreateInputZod).mutation(async ({ input }) => {
		return db.contacts.create(input);
	}),

	listContacts: protectedProcedure
		.input(contactsByClientZod)
		.query(async ({ input: { clienteId } }) => {
			return db.contacts
				.where({ clienteId })
				.order({ isPrimary: "DESC", nome: "ASC" })
				.limit(RELATED_MAX_LIMIT);
		}),

	updateContact: protectedProcedure
		.input(contactCreateInputZod.omit({ clienteId: true }).extend({ contactId: z.string().uuid() }))
		.mutation(async ({ input: { contactId, ...data } }) => {
			const contact = await db.contacts.findOptional(contactId);
			if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
			return db.contacts.where({ contactId }).update(data);
		}),

	addAddress: protectedProcedure.input(addressCreateInputZod).mutation(async ({ input }) => {
		return db.addresses.create(input);
	}),

	listAddresses: protectedProcedure
		.input(addressesByClientZod)
		.query(async ({ input: { clienteId } }) => {
			return db.addresses.where({ clienteId }).limit(RELATED_MAX_LIMIT);
		}),

	updateAddress: protectedProcedure
		.input(addressCreateInputZod.omit({ clienteId: true }).extend({ addressId: z.string().uuid() }))
		.mutation(async ({ input: { addressId, ...data } }) => {
			const address = await db.addresses.findOptional(addressId);
			if (!address) throw new TRPCError({ code: "NOT_FOUND", message: "Endereço não encontrado" });
			return db.addresses.where({ addressId }).update(data);
		}),
});
