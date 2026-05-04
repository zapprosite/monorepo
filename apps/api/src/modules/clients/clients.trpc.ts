import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { trpcRouter } from '@backend/trpc';
import {
	addressCreateInputZod,
	addressesByClientZod,
} from '@repo/zod-schemas/address.zod';
import {
	clientCreateInputZod,
	clientGetByIdZod,
	clientUpdateInputZod,
	listClientsFilterZod,
} from '@repo/zod-schemas/client.zod';
import {
	contactCreateInputZod,
	contactsByClientZod,
} from '@repo/zod-schemas/contact.zod';
import z from 'zod';

const CLIENTS_MAX_LIMIT = 200;
const RELATED_MAX_LIMIT = 100;

const clientsCrud = createCrudRouter({
	table: db.clients,
	schemas: {
		list: listClientsFilterZod,
		create: clientCreateInputZod,
		update: clientUpdateInputZod,
		delete: clientGetByIdZod,
		getById: clientGetByIdZod,
	},
	idColumn: 'clientId',
	teamColumn: 'teamId',
	maxListLimit: CLIENTS_MAX_LIMIT,
	defaultOrder: { nome: 'ASC' },
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

const contactsCrud = createCrudRouter({
	table: db.contacts,
	schemas: {
		list: contactsByClientZod,
		create: contactCreateInputZod,
		update: contactCreateInputZod
			.omit({ clienteId: true })
			.extend({ contactId: z.string().uuid() }),
		delete: z.object({ contactId: z.string().uuid() }),
		getById: z.object({ contactId: z.string().uuid() }),
	},
	idColumn: 'contactId',
	teamColumn: 'teamId',
	maxListLimit: RELATED_MAX_LIMIT,
	defaultOrder: { isPrimary: 'DESC', nome: 'ASC' },
});

const addressesCrud = createCrudRouter({
	table: db.addresses,
	schemas: {
		list: addressesByClientZod,
		create: addressCreateInputZod,
		update: addressCreateInputZod
			.omit({ clienteId: true })
			.extend({ addressId: z.string().uuid() }),
		delete: z.object({ addressId: z.string().uuid() }),
		getById: z.object({ addressId: z.string().uuid() }),
	},
	idColumn: 'addressId',
	teamColumn: 'teamId',
	maxListLimit: RELATED_MAX_LIMIT,
});

export const clientsRouterTrpc = trpcRouter({
	listClients: clientsCrud.list,
	getClientDetail: clientsCrud.getById,
	createClient: clientsCrud.create,
	updateClient: clientsCrud.update,
	deleteClient: clientsCrud.delete,

	listContacts: contactsCrud.list,
	addContact: contactsCrud.create,
	updateContact: contactsCrud.update,

	listAddresses: addressesCrud.list,
	addAddress: addressesCrud.create,
	updateAddress: addressesCrud.update,
});
