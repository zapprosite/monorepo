import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { promptGetActiveZod, promptGetByIdZod } from '@repo/zod-schemas/prompt.zod';
import { TRPCError } from '@trpc/server';

export const promptsRouterTrpc = trpcRouter({
	getAllActive: protectedProcedure.query(async () => {
		const prompts = await db.prompts
			.where({ isActive: true })
			.select('*')
			.order({ createdAt: 'DESC' });

		return prompts;
	}),

	getRandomActive: protectedProcedure.query(async () => {
		const count = await db.prompts.where({ isActive: true }).count();

		if (count === 0) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'No active prompts available' });
		}

		for (let attempt = 0; attempt < 3; attempt++) {
			const randomIndex = Math.floor(Math.random() * count);
			const prompt = await db.prompts
				.where({ isActive: true, promptId: { gte: randomIndex } })
				.select('*')
				.limit(1)
				.take();

			if (prompt) {
				return prompt;
			}
		}

		throw new TRPCError({ code: 'NOT_FOUND', message: 'Failed to retrieve a random active prompt' });
	}),

	getById: protectedProcedure.input(promptGetByIdZod).query(async ({ input: { promptId } }) => {
		const prompt = await db.prompts.find(promptId);

		if (!prompt) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Prompt not found' });
		}

		return prompt;
	}),

	getByCategory: protectedProcedure.input(promptGetActiveZod).query(async ({ input }) => {
		const prompts = await db.prompts
			.where({ isActive: input.isActive })
			.select('*')
			.order({ createdAt: 'DESC' });

		return prompts;
	}),
});
