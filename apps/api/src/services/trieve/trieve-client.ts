/**
 * SPEC-092 — Trieve RAG Integration
 * HTTP client for Trieve API
 * Anti-hardcoded: all config via process.env (TRIEVE_URL, TRIEVE_API_KEY)
 */

import type {
  CreateDatasetRequest,
  RagRetrieveResult,
  TrieveSearchResult,
  UploadChunkRequest,
} from './types.js';

// ── Config ──────────────────────────────────────────────────────────────────────

const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY ?? '';

// ── HTTP Helper ────────────────────────────────────────────────────────────────

async function trieveRequest<T>(
  path: string,
  options: RequestInit & { queryParams?: Record<string, string> } = {},
): Promise<T> {
  const { queryParams, ...fetchOptions } = options;

  let url = `${TRIEVE_URL}${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TRIEVE_API_KEY}`,
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trieve request failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Health ─────────────────────────────────────────────────────────────────────

export async function trieveHealth(): Promise<{ status: string }> {
  return trieveRequest<{ status: string }>('/api/v1/health');
}

// ── Datasets ───────────────────────────────────────────────────────────────────

export interface Dataset {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export async function createDataset(
  name: string,
  description: string,
): Promise<{ dataset: Dataset }> {
  return trieveRequest<{ dataset: Dataset }>('/api/v1/datasets', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function listDatasets(): Promise<{ datasets: Dataset[] }> {
  return trieveRequest<{ datasets: Dataset[] }>('/api/v1/datasets');
}

export async function getDataset(datasetId: string): Promise<Dataset> {
  return trieveRequest<Dataset>(`/api/v1/datasets/${datasetId}`);
}

// ── Chunks ─────────────────────────────────────────────────────────────────────

export interface Chunk {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

export async function uploadChunk(
  datasetId: string,
  content: string,
  metadata: Record<string, string> = {},
): Promise<{ chunk: Chunk }> {
  return trieveRequest<{ chunk: Chunk }>('/api/v1/chunks', {
    method: 'POST',
    body: JSON.stringify({ dataset_id: datasetId, content, metadata }),
  });
}

export async function uploadChunks(
  datasetId: string,
  chunks: Array<{ content: string; metadata?: Record<string, string> }>,
): Promise<{ successful_chunks: number; failed_chunks: number }> {
  return trieveRequest<{ successful_chunks: number; failed_chunks: number }>(
    '/api/v1/chunks',
    {
      method: 'POST',
      body: JSON.stringify({
        dataset_id: datasetId,
        chunks: chunks.map((c) => ({ content: c.content, metadata: c.metadata ?? {} })),
      }),
    },
  );
}

// ── Search ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  score: number;
  chunk: Chunk;
}

export async function search(
  datasetId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const data = await trieveRequest<{ results: SearchResult[] }>('/api/v1/search', {
    method: 'POST',
    body: JSON.stringify({ query, dataset_id: datasetId, limit }),
  });

  return data.results ?? [];
}

// ── rag_retrieve (core function from SPEC-092) ────────────────────────────────

/**
 * Retrieves relevant document chunks from Trieve RAG pipeline.
 * This is the main RAG function referenced in SPEC-092.
 *
 * @param query - Natural language query to search for relevant chunks
 * @param top_k - Number of chunks to retrieve (default: 5)
 * @returns Array of content strings with relevance scores
 */
export async function ragRetrieve(
  query: string,
  top_k = 5,
): Promise<RagRetrieveResult[]> {
  // Get the configured dataset ID from env, or use a default
  const datasetId = process.env.TRIEVE_DEFAULT_DATASET_ID;

  if (!datasetId) {
    throw new Error(
      'TRIEVE_DEFAULT_DATASET_ID not set. Set it to your knowledge base dataset ID.',
    );
  }

  const results = await search(datasetId, query, top_k);

  return results.map((r: SearchResult): RagRetrieveResult => ({
    content: r.chunk.content,
    score: r.score,
    source: r.chunk.metadata?.['source'] ?? r.chunk.metadata?.['file'] ?? undefined,
  }));
}
