import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

const haystackDatasetZod = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

const haystackSearchResultZod = z.object({
	id: z.string(),
	score: z.number(),
	chunk: z.object({
		id: z.string(),
		content: z.string(),
		metadata: z.record(z.string(), z.string()),
	}),
});

export const haystackRouter = trpcRouter({
	listDatasets: protectedProcedure.output(z.array(haystackDatasetZod)).query(async () => []),

	search: protectedProcedure
		.input(
			z.object({
				query: z.string().min(1),
				datasetId: z.string().min(1),
				limit: z.number().int().min(1).max(50).default(10),
			}),
		)
		.output(z.array(haystackSearchResultZod))
		.query(async () => []),
});
