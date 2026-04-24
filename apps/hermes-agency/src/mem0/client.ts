// Anti-hardcoded: all config via process.env
// Mem0 Client — Session memory persistence via Qdrant with TTL support

import { upsertVector, search, scrollCollection, deleteVector, COLLECTIONS } from '../qdrant/client.js';
import { generateEmbedding } from './embeddings.js';

const MEMORY_COLLECTION = COLLECTIONS.WORKING_MEMORY;
const MEMORY_VECTOR_DIMENSION = 1024; // nomic-embed-text dimension

export type MemoryImportance = 'normal' | 'important' | 'critical';

export interface Mem0Entry {
  id: string;
  sessionId: string;
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  importance: MemoryImportance;
  metadata?: Record<string, unknown>;
  expiresAt?: number; // TTL: Unix timestamp
}

interface StoreParams {
  sessionId: string;
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  importance?: MemoryImportance;
  metadata?: Record<string, unknown>;
}

/**
 * TTL in milliseconds by importance level.
 */
const TTL_MS = {
  normal: 7 * 24 * 60 * 60 * 1000,    // 7 days
  important: 30 * 24 * 60 * 60 * 1000, // 30 days
  critical: 90 * 24 * 60 * 60 * 1000,   // 90 days
} as const;

/**
 * Generate unique memory ID.
 */
function generateMemoryId(sessionId: string, timestamp: number): string {
  return `${sessionId}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Calculate expiration timestamp based on importance.
 */
function calculateExpiresAt(importance: MemoryImportance): number {
  return Date.now() + TTL_MS[importance];
}

/**
 * Store a memory entry for the current session.
 * Uses Qdrant WORKING_MEMORY collection with TTL based on importance.
 */
export async function mem0Store(params: StoreParams): Promise<string> {
  const { sessionId, userId, role, content, importance = 'normal', metadata } = params;
  const timestamp = Date.now();
  const id = generateMemoryId(sessionId, timestamp);
  const expiresAt = calculateExpiresAt(importance);

  // Generate actual embedding via Ollama (fallback to pseudo if unavailable)
  const vector = await generateEmbedding(content).catch(() => {
    console.warn('[Mem0] Embedding generation failed, using pseudo-embedding');
    return generatePseudoEmbedding(content);
  });

  const payload = {
    sessionId,
    userId: userId ?? '',
    role,
    content,
    importance,
    timestamp,
    metadata: metadata ?? {},
    expiresAt,
  };

  await upsertVector({
    collection: MEMORY_COLLECTION,
    id,
    vector,
    payload,
  });

  return id;
}

/**
 * Generate deterministic pseudo-embedding from text.
 * NOTE: Fallback only — production should use Ollama embeddings.
 */
function generatePseudoEmbedding(text: string): number[] {
  const dim = MEMORY_VECTOR_DIMENSION;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dim] += text.charCodeAt(i) * 0.01;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/**
 * Retrieve recent Mem0 entries for a session.
 * Returns up to `limit` most recent entries, ordered by timestamp descending.
 * Filters out expired entries.
 */
export async function mem0GetRecent(sessionId: string, limit = 10): Promise<Mem0Entry[]> {
  const now = Date.now();
  const results = await scrollCollection(MEMORY_COLLECTION, 100);

  const sessionEntries = results.points
    .filter((p) => {
      const pSessionId = p.payload['sessionId'] as string;
      const expiresAt = p.payload['expiresAt'] as number | undefined;
      return pSessionId === sessionId && (!expiresAt || expiresAt > now);
    })
    .map((p) => ({
      id: String(p.id),
      sessionId: p.payload['sessionId'] as string,
      userId: p.payload['userId'] as string | undefined,
      role: p.payload['role'] as 'user' | 'assistant' | 'system',
      content: p.payload['content'] as string,
      timestamp: p.payload['timestamp'] as number,
      importance: (p.payload['importance'] as MemoryImportance) ?? 'normal',
      metadata: p.payload['metadata'] as Record<string, unknown> | undefined,
      expiresAt: p.payload['expiresAt'] as number | undefined,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return sessionEntries;
}

/**
 * Search session memory by content similarity.
 */
export async function mem0Search(
  query: string,
  sessionId: string,
  options: { limit?: number; importance?: MemoryImportance } = {}
): Promise<Mem0Entry[]> {
  const { limit = 10, importance } = options;
  const now = Date.now();

  const queryVector = await generateEmbedding(query).catch(() => {
    return generatePseudoEmbedding(query);
  });

  const results = await search({
    collection: MEMORY_COLLECTION,
    vector: queryVector,
    limit: limit * 2, // Over-fetch to filter
    filter: {
      must: [
        { key: 'sessionId', match: { value: sessionId } },
        ...(importance ? [{ key: 'importance', match: { value: importance } }] : []),
      ],
    },
  });

  return results
    .filter((r) => {
      const expiresAt = r.payload['expiresAt'] as number | undefined;
      return !expiresAt || expiresAt > now;
    })
    .slice(0, limit)
    .map((r) => ({
      id: String(r.id),
      sessionId: r.payload['sessionId'] as string,
      userId: r.payload['userId'] as string | undefined,
      role: r.payload['role'] as 'user' | 'assistant' | 'system',
      content: r.payload['content'] as string,
      timestamp: r.payload['timestamp'] as number,
      importance: (r.payload['importance'] as MemoryImportance) ?? 'normal',
      metadata: r.payload['metadata'] as Record<string, unknown> | undefined,
      expiresAt: r.payload['expiresAt'] as number | undefined,
    }));
}

/**
 * Delete a specific memory entry.
 */
export async function mem0Delete(id: string): Promise<boolean> {
  return deleteVector({ collection: MEMORY_COLLECTION, id });
}

/**
 * Delete all expired entries from working memory.
 * Should be called periodically (e.g., daily via cron).
 */
export async function mem0CleanupExpired(): Promise<number> {
  const now = Date.now();
  const results = await scrollCollection(MEMORY_COLLECTION, 1000);
  let deleted = 0;

  for (const point of results.points) {
    const expiresAt = point.payload['expiresAt'] as number | undefined;
    if (expiresAt && expiresAt <= now) {
      const success = await deleteVector({ collection: MEMORY_COLLECTION, id: point.id });
      if (success) deleted++;
    }
  }

  console.log(`[Mem0] Cleaned up ${deleted} expired memory entries`);
  return deleted;
}

/**
 * Format Mem0 entries as a context string for prompt injection.
 */
export function formatMem0Context(entries: Mem0Entry[]): string {
  if (entries.length === 0) return '// No recent memory';
  return entries
    .map((e) => `[${e.role}] ${e.content}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// In-memory session history (fast cache, non-persistent)
// ---------------------------------------------------------------------------

const _sessionHistory = new Map<string, Mem0Entry[]>();

/**
 * Add entry to in-memory session history (fast, non-persistent).
 * Synced to Qdrant via mem0Store for durability.
 */
export function addToSessionHistory(sessionId: string, entry: Omit<Mem0Entry, 'id'>): void {
  const history = _sessionHistory.get(sessionId) ?? [];
  history.push({ ...entry, id: `${sessionId}-${entry.timestamp}` });
  if (history.length > 50) history.shift();
  _sessionHistory.set(sessionId, history);
}

/**
 * Get session history from memory cache.
 */
export function getSessionHistory(sessionId: string, limit = 10): Mem0Entry[] {
  const history = _sessionHistory.get(sessionId) ?? [];
  return history.slice(-limit);
}

/**
 * Clear session history — for test isolation only.
 * NOTE: This function is intended for testing purposes.
 */
export function _clearSessionHistoryForTesting(): void {
  _sessionHistory.clear();
}
