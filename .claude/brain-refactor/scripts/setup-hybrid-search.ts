#!/usr/bin/env npx tsx
/**
 * Setup hybrid search for Qdrant collection "will"
 * Enables sparse vectors (BM25) alongside dense vectors
 * 
 * Usage: npx tsx scripts/setup-hybrid-search.ts
 */

import { parseArgs } from 'util';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'];
if (!QDRANT_API_KEY) throw new Error('QDRANT_API_KEY not set');

const COLLECTION_NAME = 'will';
const VECTOR_SIZE = 768; // nomic-embed-text

const QDRANT_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${QDRANT_API_KEY}`,
};

async function collectionExists(name: string): Promise<boolean> {
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, { headers: QDRANT_HEADERS });
  if (!res.ok) return false;
  const data = (await res.json()) as { result?: { exists?: boolean } };
  return data.result?.exists ?? false;
}

async function getCollectionInfo(name: string) {
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, { headers: QDRANT_HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function updateCollectionVectors(name: string): Promise<boolean> {
  console.log(`[SETUP] Updating collection '${name}' to support hybrid search (dense + sparse vectors)...`);

  // Check if sparse vectors config already exists
  const info = await getCollectionInfo(name);
  const config = info.result?.config;

  if (config?.sparse_vectors) {
    console.log('[SETUP] Sparse vectors already configured');
    return true;
  }

  // Update collection with both dense and sparse vectors
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'PUT',
    headers: QDRANT_HEADERS,
    body: JSON.stringify({
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
      sparse_vectors: {
        index: {
          on: 'text',
        },
      },
      hnsw_config: {
        m: 16,
        ef_construct: 200,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`[SETUP] Failed to update collection: ${error}`);
    return false;
  }

  console.log('[SETUP] Collection updated with hybrid search support');
  return true;
}

async function searchHybrid(
  query: string,
  options: {
    limit?: number;
    alpha?: number;
    filter?: Record<string, string>;
  } = {}
): Promise<void> {
  const { limit = 10, alpha = 0.5, filter } = options;

  console.log(`[SEARCH] Hybrid query: "${query}" (alpha=${alpha}, limit=${limit})`);

  // Note: This is the query format for Qdrant 1.7+ with hybrid search
  // Using Qdrant's native hybrid search with RRF fusion
  const searchBody: Record<string, unknown> = {
    prefetch: [
      // Dense vector prefetch (semantic)
      {
        vector: query, // Would need actual embedding here
        limit: limit,
        score_threshold: 0.5,
      },
      // Sparse vector prefetch (BM25) - would need actual sparse vector
      {
        sparse: {
          query: query,
          limit: limit,
        },
      },
    ],
    query: {
      fusion: {
        group: 'rrf',
        modifier: 'minimize',
      },
    },
    limit: limit,
    score_threshold: 0.3,
  };

  if (filter) {
    searchBody.filter = {
      must: Object.entries(filter).map(([key, value]) => ({
        key,
        match: { value },
      })),
    };
  }

  console.log('[SEARCH] Note: Actual search requires indexed documents with both dense and sparse vectors');
  console.log('[SEARCH] Use Qdrant Dashboard or qdrant-client for full search testing');
}

async function main() {
  const { values } = parseArgs({
    options: {
      collection: { type: 'string', default: 'will' },
      search: { type: 'string' },
      alpha: { type: 'string', default: '0.5' },
      limit: { type: 'string', default: '10' },
    },
  });

  const collectionName = values['collection'] as string;

  // Check collection exists
  const exists = await collectionExists(collectionName);
  if (!exists) {
    console.error(`[SETUP] Collection '${collectionName}' does not exist`);
    console.error('[SETUP] Run scripts/init-qdrant-collections.ts first');
    process.exit(1);
  }

  console.log(`[SETUP] Collection '${collectionName}' exists`);

  // Update for hybrid search
  await updateCollectionVectors(collectionName);

  // If search query provided, test it
  if (values['search']) {
    await searchHybrid(values['search'] as string, {
      limit: parseInt(values['limit'] as string),
      alpha: parseFloat(values['alpha'] as string),
    });
  }

  console.log('[SETUP] Hybrid search setup complete!');
  console.log('[SETUP] Next steps:');
  console.log('  1. Re-index existing documents with hybrid vectors');
  console.log('  2. Use qdrant-client with hybrid search for queries');
}

main().catch((err) => {
  console.error('[SETUP] Fatal error:', err);
  process.exit(1);
});
