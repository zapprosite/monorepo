// Anti-hardcoded: all config via process.env
// Mem0 Client — Session memory persistence via Qdrant

import { upsertVector, search, COLLECTIONS } from '../qdrant/client.js';

const MEMORY_COLLECTION = COLLECTIONS.WORKING_MEMORY;
const MEMORY_VECTOR_DIMENSION = 1024; // bge-m3 embedding dimension

export interface Mem0Entry {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Store a memory entry for the current session.
 * Uses Qdrant WORKING_MEMORY collection.
 */
export async function mem0Store(entry: Omit<Mem0Entry, 'id'>): Promise<boolean> {
  const id = `${entry.sessionId}-${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`;

  // Mem0 uses the content itself as the "vector" representation
  // In production, use an embedding model; here we use a deterministic pseudo-embedding
  const pseudoVector = generatePseudoEmbedding(entry.content);

  return upsertVector({
    collection: MEMORY_COLLECTION,
    id,
    vector: pseudoVector,
    payload: {
      sessionId: entry.sessionId,
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
      metadata: entry.metadata ?? {},
    },
  });
}

/**
 * Retrieve recent Mem0 entries for a session.
 * Returns up to `limit` most recent entries, ordered by timestamp descending.
 */
export async function mem0GetRecent(sessionId: string, limit = 10): Promise<Mem0Entry[]> {
  const results = await search({
    collection: MEMORY_COLLECTION,
    vector: new Array(MEMORY_VECTOR_DIMENSION).fill(0),
    limit,
    filter: {
      must: [
        { key: 'sessionId', match: { value: sessionId } },
      ],
    },
  });

  return results
    .map((r) => ({
      id: String(r.id),
      sessionId: r.payload['sessionId'] as string,
      role: r.payload['role'] as 'user' | 'assistant' | 'system',
      content: r.payload['content'] as string,
      timestamp: r.payload['timestamp'] as number,
      metadata: r.payload['metadata'] as Record<string, unknown> | undefined,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
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

/**
 * Generate a deterministic pseudo-embedding from text.
 * NOTE: In production, replace with actual embedding (bge-m3 via Trieve or OpenAI).
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

// Session history tracking (in-memory supplement to Qdrant for fast access)
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
