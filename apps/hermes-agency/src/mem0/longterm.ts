// Anti-hardcoded: all config via process.env
// Long-Term Memory Manager — Agency domain collections via Qdrant

import {
  upsertVector,
  search,
  scrollCollection,
  deleteVector,
  getPoint,
  updatePoint,
  COLLECTIONS,
  type CollectionName,
  type PointPayload,
} from '../qdrant/client.js';
import { generateEmbedding } from './embeddings.js';

const VECTOR_DIMENSION = 1024; // nomic-embed-text

/**
 * Memory types for long-term storage.
 */
export type LongTermMemoryType =
  | 'preference'
  | 'campaign_context'
  | 'brand_guideline'
  | 'interaction_history'
  | 'feedback'
  | 'fact'
  | 'knowledge';

/**
 * Base interface for long-term memory entries.
 */
export interface LongTermMemoryEntry {
  id: string;
  entityId: string;           // client_id, campaign_id, etc.
  entityType: 'client' | 'campaign' | 'brand' | 'agent' | 'knowledge';
  memoryType: LongTermMemoryType;
  content: string;
  embedding?: number[];
  timestamp: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Generate unique ID for long-term memory.
 */
function generateLongTermId(entityId: string, memoryType: string, timestamp: number): string {
  return `${entityId}-${memoryType}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Generic Collection Operations
// ---------------------------------------------------------------------------

interface StoreLongTermParams {
  collection: CollectionName;
  entityId: string;
  entityType: LongTermMemoryEntry['entityType'];
  memoryType: LongTermMemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Store a long-term memory entry in the appropriate collection.
 */
export async function longTermMemoryStore(params: StoreLongTermParams): Promise<string> {
  const { collection, entityId, entityType, memoryType, content, metadata, tags } = params;
  const timestamp = Date.now();
  const id = generateLongTermId(entityId, memoryType, timestamp);

  // Generate embedding
  const vector = await generateEmbedding(content).catch(() => {
    console.warn('[LongTermMem] Embedding failed, using pseudo');
    return generatePseudoEmbedding(content);
  });

  const payload: PointPayload = {
    entityId,
    entityType,
    memoryType,
    content,
    timestamp,
    metadata: metadata ?? {},
    tags: tags ?? [],
  };

  await upsertVector({ collection, id, vector, payload });
  return id;
}

/**
 * Retrieve all memories for an entity.
 */
export async function longTermMemoryGet(
  collection: CollectionName,
  entityId: string
): Promise<LongTermMemoryEntry[]> {
  const results = await scrollCollection(collection, 100);

  return results.points
    .filter((p) => (p.payload['entityId'] as string) === entityId)
    .map((p) => ({
      id: String(p.id),
      entityId: p.payload['entityId'] as string,
      entityType: p.payload['entityType'] as LongTermMemoryEntry['entityType'],
      memoryType: p.payload['memoryType'] as LongTermMemoryType,
      content: p.payload['content'] as string,
      timestamp: p.payload['timestamp'] as number,
      metadata: p.payload['metadata'] as Record<string, unknown> | undefined,
      tags: p.payload['tags'] as string[] | undefined,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Search long-term memories across a collection.
 */
export async function longTermMemorySearch(
  collection: CollectionName,
  query: string,
  options: {
    entityId?: string;
    memoryType?: LongTermMemoryType;
    tags?: string[];
    limit?: number;
  } = {}
): Promise<LongTermMemoryEntry[]> {
  const { entityId, memoryType, tags, limit = 10 } = options;

  const queryVector = await generateEmbedding(query).catch(() => {
    return generatePseudoEmbedding(query);
  });

  const filter: Parameters<typeof search>[0]['filter'] = {
    must: [
      ...(entityId ? [{ key: 'entityId', match: { value: entityId } }] : []),
      ...(memoryType ? [{ key: 'memoryType', match: { value: memoryType } }] : []),
      ...(tags && tags.length > 0
        ? [{ key: 'tags', match: { any: tags } }]
        : []),
    ],
  };

  const results = await search({
    collection,
    vector: queryVector,
    limit,
    filter,
  });

  return results.map((r) => ({
    id: String(r.id),
    entityId: r.payload['entityId'] as string,
    entityType: r.payload['entityType'] as LongTermMemoryEntry['entityType'],
    memoryType: r.payload['memoryType'] as LongTermMemoryType,
    content: r.payload['content'] as string,
    timestamp: r.payload['timestamp'] as number,
    metadata: r.payload['metadata'] as Record<string, unknown> | undefined,
    tags: r.payload['tags'] as string[] | undefined,
  }));
}

/**
 * Delete a long-term memory entry.
 */
export async function longTermMemoryDelete(collection: CollectionName, id: string): Promise<boolean> {
  return deleteVector({ collection, id });
}

/**
 * Update metadata/tags on an existing memory entry.
 */
export async function longTermMemoryUpdate(
  collection: CollectionName,
  id: string,
  updates: Partial<Pick<LongTermMemoryEntry, 'metadata' | 'tags'>>
): Promise<boolean> {
  const existing = await getPoint({ collection, id });
  if (!existing) return false;

  const existingMeta = existing.payload['metadata'] as Record<string, unknown> | undefined;

  return updatePoint(collection, id, {
    ...existing.payload,
    ...(updates.metadata && { metadata: { ...existingMeta, ...updates.metadata } }),
    ...(updates.tags && { tags: updates.tags }),
  });
}

/**
 * Deterministic pseudo-embedding fallback.
 */
function generatePseudoEmbedding(text: string): number[] {
  const dim = VECTOR_DIMENSION;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dim] += text.charCodeAt(i) * 0.01;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

// ---------------------------------------------------------------------------
// Domain-Specific Convenience Methods
// ---------------------------------------------------------------------------

/**
 * Store client preference.
 */
export async function storeClientPreference(
  clientId: string,
  preference: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  return longTermMemoryStore({
    collection: COLLECTIONS.CLIENTS,
    entityId: clientId,
    entityType: 'client',
    memoryType: 'preference',
    content: preference,
    metadata,
  });
}

/**
 * Store brand guideline.
 */
export async function storeBrandGuideline(
  clientId: string,
  guideline: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  return longTermMemoryStore({
    collection: COLLECTIONS.BRAND_GUIDES,
    entityId: clientId,
    entityType: 'brand',
    memoryType: 'brand_guideline',
    content: guideline,
    metadata,
  });
}

/**
 * Store campaign context.
 */
export async function storeCampaignContext(
  campaignId: string,
  context: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  return longTermMemoryStore({
    collection: COLLECTIONS.CAMPAIGNS,
    entityId: campaignId,
    entityType: 'campaign',
    memoryType: 'campaign_context',
    content: context,
    metadata,
  });
}

/**
 * Get all memories for a client (across collections).
 */
export async function getClientMemory(clientId: string): Promise<{
  preferences: LongTermMemoryEntry[];
  brandGuidelines: LongTermMemoryEntry[];
  interactions: LongTermMemoryEntry[];
}> {
  const [preferences, brandGuidelines, interactions] = await Promise.all([
    longTermMemorySearch(COLLECTIONS.CLIENTS, '', { entityId: clientId, memoryType: 'preference' }),
    longTermMemorySearch(COLLECTIONS.BRAND_GUIDES, '', { entityId: clientId }),
    longTermMemorySearch(COLLECTIONS.CONVERSATIONS, '', { entityId: clientId }),
  ]);

  return { preferences, brandGuidelines, interactions };
}

/**
 * Search across all agency collections.
 */
export async function searchAllAgencyMemory(
  query: string,
  options: { limit?: number; collections?: CollectionName[] } = {}
): Promise<Record<CollectionName, LongTermMemoryEntry[]>> {
  const { limit = 5, collections = Object.values(COLLECTIONS).filter(c => c !== COLLECTIONS.WORKING_MEMORY) } = options;

  const results = await Promise.all(
    collections.map((collection) =>
      longTermMemorySearch(collection, query, { limit }).catch(() => [])
    )
  );

  return collections.reduce((acc, collection, i) => {
    acc[collection] = (results[i] ?? []) as LongTermMemoryEntry[];
    return acc;
  }, {} as Record<CollectionName, LongTermMemoryEntry[]>);
}

/**
 * Format long-term memory as context string for prompt injection.
 */
export function formatLongTermContext(memories: LongTermMemoryEntry[]): string {
  if (memories.length === 0) return '// No long-term memory';

  const byType = memories.reduce<Record<string, string[]>>((acc, mem) => {
    if (!acc[mem.memoryType]) acc[mem.memoryType] = [];
    acc[mem.memoryType]!.push(mem.content);
    return acc;
  }, {});

  return Object.entries(byType)
    .map(([type, contents]) => {
      const unique = [...new Set(contents)].slice(0, 3);
      return `[${type}]: ${unique.join('; ')}`;
    })
    .join('\n');
}
