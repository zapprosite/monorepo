// Anti-hardcoded: all config via process.env
// Mem0 Integration Tests — Session memory persistence via Qdrant with TTL support
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Qdrant client before importing mem0 client
// ---------------------------------------------------------------------------

vi.mock('../qdrant/client.ts', () => ({
  upsertVector: vi.fn().mockResolvedValue(true),
  search: vi.fn().mockResolvedValue([]),
  scrollCollection: vi.fn().mockResolvedValue({ points: [] }),
  deleteVector: vi.fn().mockResolvedValue(true),
  getPoint: vi.fn().mockResolvedValue(null),
  updatePoint: vi.fn().mockResolvedValue(true),
  COLLECTIONS: {
    WORKING_MEMORY: 'agency_working_memory',
    CLIENTS: 'agency_clients',
    CAMPAIGNS: 'agency_campaigns',
    CONVERSATIONS: 'agency_conversations',
    ASSETS: 'agency_assets',
    BRAND_GUIDES: 'agency_brand_guides',
    TASKS: 'agency_tasks',
    VIDEO_METADATA: 'agency_video_metadata',
    KNOWLEDGE: 'agency_knowledge',
  },
}));

// Mock embeddings to avoid Ollama calls
vi.mock('../mem0/embeddings.ts', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0).map((_, i) => Math.sin(i) * 0.1)),
  generateEmbeddings: vi.fn().mockResolvedValue([]),
  generatePseudoEmbedding: vi.fn().mockReturnValue(new Array(1024).fill(0).map((_, i) => Math.sin(i) * 0.1)),
  cosineSimilarity: vi.fn().mockReturnValue(0.85),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  mem0Store,
  mem0GetRecent,
  mem0Search,
  mem0Delete,
  mem0CleanupExpired,
  formatMem0Context,
  addToSessionHistory,
  getSessionHistory,
  type Mem0Entry,
} from '../mem0/client.js';

import { upsertVector, scrollCollection, deleteVector, search } from '../qdrant/client.js';

const mockUpsertVector = vi.mocked(upsertVector);
const mockScrollCollection = vi.mocked(scrollCollection);
const mockDeleteVector = vi.mocked(deleteVector);
const mockSearch = vi.mocked(search);

// ---------------------------------------------------------------------------
// mem0Store
// ---------------------------------------------------------------------------

describe('mem0Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores memory entry in Qdrant with correct payload', async () => {
    const memoryId = await mem0Store({
      sessionId: 'session-123',
      role: 'user',
      content: 'Hello, world!',
    });

    expect(memoryId).toBeTruthy();
    expect(memoryId).toContain('session-123');
    expect(mockUpsertVector).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'agency_working_memory',
        vector: expect.any(Array),
        payload: expect.objectContaining({
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello, world!',
          importance: 'normal',
        }),
      }),
    );
  });

  it('generates unique IDs for each entry', async () => {
    const id1 = await mem0Store({
      sessionId: 'session-123',
      role: 'user',
      content: 'First message',
    });

    const id2 = await mem0Store({
      sessionId: 'session-123',
      role: 'user',
      content: 'Second message',
    });

    expect(id1).not.toBe(id2);
  });

  it('applies correct TTL based on importance level', async () => {
    const now = Date.now();

    // Test normal importance — 7 days
    await mem0Store({
      sessionId: 'session-normal',
      role: 'user',
      content: 'Normal importance',
      importance: 'normal',
    });

    const normalPayload = mockUpsertVector.mock.calls[0]![0]!.payload;
    const normalTTL = (normalPayload as Record<string, unknown>)['expiresAt'] as number - now;
    expect(normalTTL).toBe(7 * 24 * 60 * 60 * 1000);

    // Test important importance — 30 days
    await mem0Store({
      sessionId: 'session-important',
      role: 'assistant',
      content: 'Important message',
      importance: 'important',
    });

    const importantPayload = mockUpsertVector.mock.calls[1]![0]!.payload;
    const importantTTL = (importantPayload as Record<string, unknown>)['expiresAt'] as number - now;
    expect(importantTTL).toBe(30 * 24 * 60 * 60 * 1000);

    // Test critical importance — 90 days
    await mem0Store({
      sessionId: 'session-critical',
      role: 'system',
      content: 'Critical system message',
      importance: 'critical',
    });

    const criticalPayload = mockUpsertVector.mock.calls[2]![0]!.payload;
    const criticalTTL = (criticalPayload as Record<string, unknown>)['expiresAt'] as number - now;
    expect(criticalTTL).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('stores metadata with the entry', async () => {
    await mem0Store({
      sessionId: 'session-meta',
      role: 'user',
      content: 'Message with metadata',
      metadata: { source: 'telegram', chatId: 12345 },
    });

    const payload = mockUpsertVector.mock.calls[0]![0]!.payload as Record<string, unknown>;
    expect(payload['metadata']).toEqual({ source: 'telegram', chatId: 12345 });
  });

  it('includes userId in payload when provided', async () => {
    await mem0Store({
      sessionId: 'session-user',
      userId: 'user_abc',
      role: 'user',
      content: 'Message from user',
    });

    const payload = mockUpsertVector.mock.calls[0]![0]!.payload as Record<string, unknown>;
    expect(payload['userId']).toBe('user_abc');
  });

  it('uses default userId of empty string when not provided', async () => {
    await mem0Store({
      sessionId: 'session-no-user',
      role: 'user',
      content: 'Message without userId',
    });

    const payload = mockUpsertVector.mock.calls[0]![0]!.payload as Record<string, unknown>;
    expect(payload['userId']).toBe('');
  });

  it('generates 1024-dimensional embedding', async () => {
    await mem0Store({
      sessionId: 'session-embed',
      role: 'user',
      content: 'Test embedding generation',
    });

    const vector = mockUpsertVector.mock.calls[0]![0]!.vector;
    expect(vector).toHaveLength(1024);
  });
});

// ---------------------------------------------------------------------------
// mem0GetRecent
// ---------------------------------------------------------------------------

describe('mem0GetRecent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves recent entries for a session', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        {
          id: 'point-1',
          payload: {
            sessionId: 'session-123',
            userId: 'user_1',
            role: 'user',
            content: 'First message',
            timestamp: now - 10000,
            importance: 'normal',
            expiresAt: now + 86400000,
            metadata: {},
          },
        },
        {
          id: 'point-2',
          payload: {
            sessionId: 'session-123',
            userId: 'user_1',
            role: 'assistant',
            content: 'Second message',
            timestamp: now - 5000,
            importance: 'normal',
            expiresAt: now + 86400000,
            metadata: {},
          },
        },
      ],
    });

    const results = await mem0GetRecent('session-123', 10);

    expect(results).toHaveLength(2);
    expect(results[0]!.content).toBe('Second message'); // Most recent first
    expect(results[1]!.content).toBe('First message');
  });

  it('filters out expired entries', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        {
          id: 'point-1',
          payload: {
            sessionId: 'session-123',
            userId: 'user_1',
            role: 'user',
            content: 'Expired message',
            timestamp: now - 200000,
            importance: 'normal',
            expiresAt: now - 10000, // Expired
            metadata: {},
          },
        },
        {
          id: 'point-2',
          payload: {
            sessionId: 'session-123',
            userId: 'user_1',
            role: 'assistant',
            content: 'Valid message',
            timestamp: now - 5000,
            importance: 'normal',
            expiresAt: now + 86400000, // Not expired
            metadata: {},
          },
        },
      ],
    });

    const results = await mem0GetRecent('session-123', 10);

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('Valid message');
  });

  it('filters by sessionId correctly', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        {
          id: 'point-1',
          payload: {
            sessionId: 'session-123',
            userId: 'user_1',
            role: 'user',
            content: 'Session 123 message',
            timestamp: now - 5000,
            importance: 'normal',
            expiresAt: now + 86400000,
            metadata: {},
          },
        },
        {
          id: 'point-2',
          payload: {
            sessionId: 'session-456',
            userId: 'user_2',
            role: 'user',
            content: 'Session 456 message',
            timestamp: now - 5000,
            importance: 'normal',
            expiresAt: now + 86400000,
            metadata: {},
          },
        },
      ],
    });

    const results = await mem0GetRecent('session-123', 10);

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('Session 123 message');
  });

  it('respects the limit parameter', async () => {
    const now = Date.now();
    const points = Array.from({ length: 20 }, (_, i) => ({
      id: `point-${i}`,
      payload: {
        sessionId: 'session-limit',
        userId: 'user_1',
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: now - i * 1000,
        importance: 'normal' as const,
        expiresAt: now + 86400000,
        metadata: {},
      },
    }));

    mockScrollCollection.mockResolvedValueOnce({ points });

    const results = await mem0GetRecent('session-limit', 5);

    expect(results).toHaveLength(5);
  });

  it('handles entries without expiresAt (no TTL)', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        {
          id: 'point-no-ttl',
          payload: {
            sessionId: 'session-no-ttl',
            userId: 'user_1',
            role: 'user',
            content: 'No TTL entry',
            timestamp: now - 5000,
            importance: 'normal',
            // No expiresAt field
            metadata: {},
          },
        },
      ],
    });

    const results = await mem0GetRecent('session-no-ttl', 10);

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('No TTL entry');
  });

  it('returns empty array when no entries found', async () => {
    mockScrollCollection.mockResolvedValueOnce({ points: [] });

    const results = await mem0GetRecent('nonexistent-session', 10);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mem0Search
// ---------------------------------------------------------------------------

describe('mem0Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches by content similarity', async () => {
    const now = Date.now();
    mockSearch.mockResolvedValueOnce([
      {
        id: 'search-result-1',
        score: 0.95,
        payload: {
          sessionId: 'session-search',
          userId: 'user_1',
          role: 'user',
          content: 'Campaign for new product launch',
          timestamp: now - 5000,
          importance: 'important',
          expiresAt: now + 86400000,
          metadata: {},
        },
      },
    ]);

    const results = await mem0Search('product launch', 'session-search', { limit: 5 });

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('Campaign for new product launch');
  });

  it('filters by importance level when specified', async () => {
    mockSearch.mockResolvedValueOnce([]);

    await mem0Search('query', 'session-importance', { importance: 'critical', limit: 5 });

    const searchCall = mockSearch.mock.calls[0]![0]!;
    expect(searchCall.filter).toEqual(
      expect.objectContaining({
        must: expect.arrayContaining([
          { key: 'importance', match: { value: 'critical' } },
        ]),
      }),
    );
  });

  it('respects limit parameter', async () => {
    mockSearch.mockResolvedValueOnce([]);

    await mem0Search('query', 'session-limit', { limit: 3 });

    // Over-fetch by 2x, then slice
    const searchCall = mockSearch.mock.calls[0]![0]!;
    expect(searchCall.limit).toBe(6); // limit * 2
  });
});

// ---------------------------------------------------------------------------
// mem0Delete
// ---------------------------------------------------------------------------

describe('mem0Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a memory entry by ID', async () => {
    mockDeleteVector.mockResolvedValueOnce(true);

    const result = await mem0Delete('memory-id-123');

    expect(result).toBe(true);
    expect(mockDeleteVector).toHaveBeenCalledWith({
      collection: 'agency_working_memory',
      id: 'memory-id-123',
    });
  });

  it('returns false when deletion fails', async () => {
    mockDeleteVector.mockResolvedValueOnce(false);

    const result = await mem0Delete('nonexistent-id');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mem0CleanupExpired
// ---------------------------------------------------------------------------

describe('mem0CleanupExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes all expired entries', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        { id: 'expired-1', payload: { expiresAt: now - 10000 } },
        { id: 'expired-2', payload: { expiresAt: now - 5000 } },
        { id: 'valid-1', payload: { expiresAt: now + 86400000 } },
      ],
    });
    mockDeleteVector.mockResolvedValue(true);

    const deleted = await mem0CleanupExpired();

    expect(deleted).toBe(2);
    expect(mockDeleteVector).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when no expired entries', async () => {
    const now = Date.now();
    mockScrollCollection.mockResolvedValueOnce({
      points: [
        { id: 'valid-1', payload: { expiresAt: now + 86400000 } },
        { id: 'valid-2', payload: { expiresAt: now + 86400000 } },
      ],
    });

    const deleted = await mem0CleanupExpired();

    expect(deleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatMem0Context
// ---------------------------------------------------------------------------

describe('formatMem0Context', () => {
  it('formats entries as context string', () => {
    const entries: Mem0Entry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        role: 'user',
        content: 'Preciso criar uma campanha',
        timestamp: Date.now() - 60000,
        importance: 'normal',
      },
      {
        id: 'e2',
        sessionId: 's1',
        role: 'assistant',
        content: 'Vou criar a campanha para você',
        timestamp: Date.now() - 30000,
        importance: 'normal',
      },
    ];

    const context = formatMem0Context(entries);

    expect(context).toContain('[user] Preciso criar uma campanha');
    expect(context).toContain('[assistant] Vou criar a campanha para você');
  });

  it('returns placeholder for empty entries', () => {
    const context = formatMem0Context([]);
    expect(context).toBe('// No recent memory');
  });
});

// ---------------------------------------------------------------------------
// Session history (in-memory cache)
// ---------------------------------------------------------------------------

describe('session history (in-memory cache)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addToSessionHistory stores entry in memory', () => {
    addToSessionHistory('session-cache', {
      sessionId: 'session-cache',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
      importance: 'normal',
    });

    const history = getSessionHistory('session-cache');
    expect(history).toHaveLength(1);
    expect(history[0]!.content).toBe('Test message');
  });

  it('getSessionHistory respects limit', () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      addToSessionHistory('session-limit-test', {
        sessionId: 'session-limit-test',
        role: 'user',
        content: `Message ${i}`,
        timestamp: now - i * 1000,
        importance: 'normal',
      });
    }

    const history = getSessionHistory('session-limit-test', 5);
    expect(history).toHaveLength(5);
  });

  it('session history is capped at 50 entries', () => {
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      addToSessionHistory('session-cap', {
        sessionId: 'session-cap',
        role: 'user',
        content: `Message ${i}`,
        timestamp: now - i * 1000,
        importance: 'normal',
      });
    }

    const history = getSessionHistory('session-cap');
    expect(history).toHaveLength(50);
  });

  it('returns empty array for unknown session', () => {
    const history = getSessionHistory('nonexistent-session');
    expect(history).toEqual([]);
  });

  it('generates unique ID for each history entry', () => {
    const timestamp = Date.now();
    addToSessionHistory('session-ids', {
      sessionId: 'session-ids',
      role: 'user',
      content: 'First',
      timestamp,
      importance: 'normal',
    });
    addToSessionHistory('session-ids', {
      sessionId: 'session-ids',
      role: 'user',
      content: 'Second',
      timestamp: timestamp + 1,
      importance: 'normal',
    });

    const history = getSessionHistory('session-ids');
    expect(history[0]!.id).not.toBe(history[1]!.id);
  });
});
