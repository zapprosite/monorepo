/**
 * SPEC-092 — Trieve RAG Integration
 * tRPC router for RAG search endpoints
 */

import { z } from 'zod';
import { publicProcedure, trpcRouter } from '@backend/trpc';
import { ragRetrieve, search, listDatasets, createDataset } from '@backend/services/trieve/index.js';

export const trieveRouter = trpcRouter({
  /**
   * GET /api/v1/datasets — List all datasets
   */
  listDatasets: publicProcedure.query(async () => {
    const data = await listDatasets();
    return data.datasets;
  }),

  /**
   * POST /api/v1/datasets — Create a new dataset
   */
  createDataset: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).default(''),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await createDataset(input.name, input.description);
      return result.dataset;
    }),

  /**
   * POST /api/v1/search — Search chunks in a dataset
   */
  search: publicProcedure
    .input(
      z.object({
        datasetId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().int().positive().default(5),
      }),
    )
    .mutation(async ({ input }) => {
      const results = await search(input.datasetId, input.query, input.limit);
      return results;
    }),

  /**
   * POST /api/v1/rag — RAG retrieval (core function from SPEC-092)
   * Retrieves relevant chunks for a query using the default dataset.
   */
  ragRetrieve: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        top_k: z.number().int().positive().default(5),
      }),
    )
    .mutation(async ({ input }) => {
      const results = await ragRetrieve(input.query, input.top_k);
      return results;
    }),
});

export type TrieveRouter = typeof trieveRouter;
