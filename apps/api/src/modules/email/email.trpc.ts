import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { trpcRouter } from '@backend/trpc';
import {
	emailCampaignCreateZod,
	emailCampaignListZod,
	emailCampaignUpdateZod,
} from '@repo/zod-schemas/email.zod';
import { z } from 'zod';

const EMAIL_MAX_LIMIT = 100;

const emailCampaignIdZod = z.object({
	id: z.string().uuid(),
});

const emailCampaignCrud = createCrudRouter({
	table: db.emailCampaigns,
	schemas: {
		list: emailCampaignListZod,
		create: emailCampaignCreateZod,
		update: emailCampaignUpdateZod.extend(emailCampaignIdZod.shape),
		delete: emailCampaignIdZod,
		getById: emailCampaignIdZod,
	},
	idColumn: 'id',
	maxListLimit: EMAIL_MAX_LIMIT,
	defaultOrder: { createdAt: 'DESC' },
	hooks: {
		transformListInput: (input: any) => ({
			statusCampanha: input.status,
			tipoCampanha: input.tipo,
		}),
		buildListQuery: (query: any, _input: any, ctx: any) =>
			query.where({ usuarioCriacaoId: ctx.user.userId }),
		buildGetByIdQuery: (query: any, _input: any, ctx: any) =>
			query.where({ usuarioCriacaoId: ctx.user.userId }),
		transformCreateInput: (input: any, ctx: any) => ({
			...input,
			usuarioCriacaoId: ctx.user.userId,
		}),
		transformListResult: (items: any[]) => ({ data: items }),
	},
});

export const emailRouter = trpcRouter({
	listCampaigns: emailCampaignCrud.list,
	createCampaign: emailCampaignCrud.create,
});
