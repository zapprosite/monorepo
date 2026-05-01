/**
 * SPEC-092 — Trieve RAG Integration
 * tRPC router for RAG search endpoints
 *
 * IDOR Fix: All procedures use protectedProcedure with teamId filtering.
 * Team isolation via trieve_datasets mapping table.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
  ragRetrieve,
  search,
  listDatasets as trieveListDatasets,
  createDataset as trieveCreateDataset,
} from '@backend/services/trieve/index.js';

export const trieveRouter = trpcRouter({
  /**
   * GET /api/v1/datasets — List datasets for the authenticated team
   * FIX: Filters by teamId via trieve_datasets mapping table
   */
  listDatasets: protectedProcedure.query(async ({ ctx }) => {
    const { teamId } = ctx.user;

    // Get team's dataset mappings from our DB
    const teamMappings = await db.trieveDatasets
      .select('*')
      .where({ teamId });

    if (teamMappings.length === 0) {
      return [];
    }

    // Get all datasets from Trieve and filter by team's mappings
    const trieveData = await trieveListDatasets();
    const teamDatasetIds = new Set(teamMappings.map((m) => m.trieveDatasetId));

    return trieveData.datasets
      .filter((ds) => teamDatasetIds.has(ds.id))
      .map((ds) => {
        const mapping = teamMappings.find((m) => m.trieveDatasetId === ds.id);
        return {
          ...ds,
          isDefault: mapping?.isDefault ?? false,
        };
      });
  }),

  /**
   * POST /api/v1/datasets — Create a new dataset for the authenticated team
   * FIX: Associates teamId via trieve_datasets mapping table
   */
  createDataset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).default(''),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx.user;

      // If isDefault=true, unset other defaults for this team
      if (input.isDefault) {
        await db.trieveDatasets
          .where({ teamId, isDefault: true })
          .update({ isDefault: false });
      }

      // Create dataset in Trieve
      const result = await trieveCreateDataset(input.name, input.description);

      // Store mapping in our DB for team isolation
      const mapping = await db.trieveDatasets.create({
        teamId,
        trieveDatasetId: result.dataset.id,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
      });

      return {
        ...result.dataset,
        isDefault: input.isDefault,
        localId: mapping.id,
      };
    }),

  /**
   * POST /api/v1/search — Search chunks in a dataset
   * FIX: Verifies dataset belongs to the authenticated team before searching
   */
  search: protectedProcedure
    .input(
      z.object({
        datasetId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().int().positive().default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx.user;

      // IDOR FIX: Verify dataset belongs to this team
      const mapping = await db.trieveDatasets
        .select('id')
        .where({ teamId, trieveDatasetId: input.datasetId })
        .then((r) => r[0]);

      if (!mapping) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Dataset does not belong to your team',
        });
      }

      const results = await search(input.datasetId, input.query, input.limit);
      return results;
    }),

  /**
   * POST /api/v1/rag — RAG retrieval (core function from SPEC-092)
   * FIX: Restricted to authenticated users with team-specific default dataset
   */
  ragRetrieve: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        top_k: z.number().int().positive().default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx.user;

      // Get team's default dataset
      const defaultDataset = await db.trieveDatasets
        .select('trieveDatasetId')
        .where({ teamId, isDefault: true })
        .then((r) => r[0]);

      if (!defaultDataset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No default RAG dataset configured for your team',
        });
      }

      const results = await search(
        defaultDataset.trieveDatasetId,
        input.query,
        input.top_k,
      );
      return results;
    }),
});

export type TrieveRouter = typeof trieveRouter;