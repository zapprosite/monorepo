import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	emailCampaignCreateZod,
	emailCampaignListZod,
} from '@connected-repo/zod-schemas/email.zod';

// @ts-expect-error TS2742 — pqb internal type inference not portable
export const emailRouter = trpcRouter({
	listCampaigns: protectedProcedure.input(emailCampaignListZod).query(async ({ input }) => {
		let query = db.emailCampaigns.select('*');
		if (input.status) query = query.where({ statusCampanha: input.status });
		if (input.tipo) query = query.where({ tipoCampanha: input.tipo });
		const rows = await query.order({ createdAt: 'DESC' }).limit(input.limit).offset(input.offset);
		return { data: rows };
	}),

	createCampaign: protectedProcedure
		.input(emailCampaignCreateZod)
		.mutation(async ({ ctx, input }) => {
			return db.emailCampaigns.create({
				...input,
				usuarioCriacaoId: ctx.user.userId,
			});
		}),
});
