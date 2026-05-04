import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	journalEntryCreateInputZod,
	journalEntryDeleteZod,
	journalEntryGetByIdZod,
	journalEntryGetByUserZod,
} from '@repo/zod-schemas/journal_entry.zod';
import { TRPCError } from '@trpc/server';

export const journalEntriesRouterTrpc = trpcRouter({
	getAll: protectedProcedure.query(
		async ({
			ctx: {
				user: { userId },
			},
		}) => {
			const journalEntries = await db.journalEntries
				.select('*', {
					author: (t) => t.author.selectAll(),
				})
				.where({ authorUserId: userId });
			return journalEntries;
		},
	),

	getById: protectedProcedure.input(journalEntryGetByIdZod).query(
		async ({
			input: { journalEntryId },
			ctx: {
				user: { userId },
			},
		}) => {
			const journalEntry = await db.journalEntries
				.find(journalEntryId)
				.where({ authorUserId: userId });

			if (!journalEntry) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
			}

			return journalEntry;
		},
	),

	create: protectedProcedure
		.input(journalEntryCreateInputZod)
		.mutation(async ({ input, ctx: { user } }) => {
			const newJournalEntry = await db.journalEntries.create({
				authorUserId: user.userId,
				promptId: input.promptId,
				prompt: input.prompt,
				content: input.content,
			});
			return newJournalEntry;
		}),

	getByUser: protectedProcedure.input(journalEntryGetByUserZod).query(async ({ input, ctx }) => {
		const { userId } = ctx.user;
		if (input.authorUserId !== userId) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot view other users journal entries' });
		}
		const journalEntries = await db.journalEntries
			.select('*', {
				author: (t) => t.author.selectAll(),
			})
			.where({ authorUserId: userId })
			.order({ createdAt: 'DESC' });

		return journalEntries;
	}),

	delete: protectedProcedure.input(journalEntryDeleteZod).mutation(
		async ({
			input: { journalEntryId },
			ctx: {
				user: { userId },
			},
		}) => {
			await db.journalEntries.find(journalEntryId).where({ authorUserId: userId }).delete();

			return { success: true };
		},
	),
});