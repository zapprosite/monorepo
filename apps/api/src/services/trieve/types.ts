/**
 * SPEC-092 — Trieve RAG Integration
 * Zod schemas for Trieve API payloads
 */

import { z } from 'zod';

// ── Trieve Config ────────────────────────────────────────────────────────────────

export const TrieveConfigSchema = z.object({
  url: z.string().url().default('http://localhost:6435'),
  apiKey: z.string().min(1),
});

export type TrieveConfig = z.infer<typeof TrieveConfigSchema>;

// ── Dataset ───────────────────────────────────────────────────────────────────────

export const TrieveDatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
});

export type TrieveDataset = z.infer<typeof TrieveDatasetSchema>;

// ── Chunk ──────────────────────────────────────────────────────────────────────

export const TrieveChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.string()).default({}),
});

export type TrieveChunk = z.infer<typeof TrieveChunkSchema>;

// ── Search ─────────────────────────────────────────────────────────────────────

export const TrieveSearchRequestSchema = z.object({
  query: z.string().min(1),
  dataset_id: z.string().uuid(),
  limit: z.number().int().positive().default(5),
  recency_days: z.number().int().positive().optional(),
  rerank: z.boolean().optional(),
});

export type TrieveSearchRequest = z.infer<typeof TrieveSearchRequestSchema>;

export const TrieveSearchResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  chunk: TrieveChunkSchema,
});

export type TrieveSearchResult = z.infer<typeof TrieveSearchResultSchema>;

export const TrieveSearchResponseSchema = z.object({
  results: z.array(TrieveSearchResultSchema),
});

export type TrieveSearchResponse = z.infer<typeof TrieveSearchResponseSchema>;

// ── Create Dataset ──────────────────────────────────────────────────────────────

export const CreateDatasetRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
});

export type CreateDatasetRequest = z.infer<typeof CreateDatasetRequestSchema>;

// ── Upload Chunk ────────────────────────────────────────────────────────────────

export const UploadChunkRequestSchema = z.object({
  dataset_id: z.string().uuid(),
  content: z.string().min(1),
  metadata: z.record(z.string()).default({}),
});

export type UploadChunkRequest = z.infer<typeof UploadChunkRequestSchema>;

// ── rag_retrieve output ────────────────────────────────────────────────────────

export const RagRetrieveResultSchema = z.object({
  content: z.string(),
  score: z.number(),
  source: z.string().optional(),
});

export type RagRetrieveResult = z.infer<typeof RagRetrieveResultSchema>;
