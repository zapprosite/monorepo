import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	clientCreateInputZod,
	clientGetByIdZod,
	clientUpdateInputZod,
	listClientsFilterZod,
} from "@connected-repo/zod-schemas/client.zod";
import {
	addressCreateInputZod,
	addressesByClientZod,
} from "@connected-repo/zod-schemas/address.zod";
import {
	contactCreateInputZod,
	contactsByClientZod,
} from "@connected-repo/zod-schemas/contact.zod";

const CLIENTS_MAX_LIMIT = 200;
const RELATED_MAX_LIMIT = 100;

export const clientsRouterTrpc = trpcRouter({
	listClients: protectedProcedure
		.input(listClientsFilterZod)
		.query(async ({ input }) => {
			let query = db.clients.select("*");

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
		.query(async ({ input: { clientId } }) => {
			return db.clients.find(clientId);
		}),

	createClient: protectedProcedure
		.input(clientCreateInputZod)
		.mutation(async ({ input }) => {
			return db.clients.create(input);
		}),

	updateClient: protectedProcedure
		.input(clientUpdateInputZod)
		.mutation(async ({ input: { clientId, ...data } }) => {
			return db.clients.find(clientId).update(data);
		}),

	addContact: protectedProcedure
		.input(contactCreateInputZod)
		.mutation(async ({ input }) => {
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

	addAddress: protectedProcedure
		.input(addressCreateInputZod)
		.mutation(async ({ input }) => {
			return db.addresses.create(input);
		}),

	listAddresses: protectedProcedure
		.input(addressesByClientZod)
		.query(async ({ input: { clienteId } }) => {
			return db.addresses.where({ clienteId }).limit(RELATED_MAX_LIMIT);
		}),
});
