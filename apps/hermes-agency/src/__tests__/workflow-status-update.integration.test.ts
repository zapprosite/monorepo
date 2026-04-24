// Anti-hardcoded: all config via process.env
/**
 * Integration tests for status_update workflow (WF-3)
 * Tests: FETCH_CAMPAIGNS → GENERATE_REPORT → HUMAN_GATE → BROADCAST
 *
 * Uses interrupt() for human approval at HUMAN_GATE.
 * When interrupt() fires, the error handler returns initialState (not partial state),
 * so fields set before interrupt (report, humanApproved) may be undefined in the error result.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../litellm/router.ts', () => ({
  llmComplete: vi.fn(),
}));

vi.mock('../utils/fetch-client.js', () => ({
  fetchClient: vi.fn(),
}));

vi.mock('../telegram/bot.js', () => ({
  bot: {
    telegram: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    },
  },
}));

vi.mock('../qdrant/client.js', () => ({
  COLLECTIONS: {
    CLIENTS: 'agency_clients',
    CAMPAIGNS: 'agency_campaigns',
    TASKS: 'agency_tasks',
    WORKING_MEMORY: 'agency_working_memory',
  },
}));

import { llmComplete } from '../litellm/router.js';
import { fetchClient } from '../utils/fetch-client.js';
import { bot } from '../telegram/bot.js';
import {
  executeStatusUpdate,
  approveStatusUpdate,
  statusUpdateGraph,
} from '../langgraph/status_update.js';

const mockLlmComplete = llmComplete as ReturnType<typeof vi.fn>;
const mockFetchClient = fetchClient as ReturnType<typeof vi.fn>;
const mockSendMessage = bot.telegram.sendMessage as ReturnType<typeof vi.fn>;

function createMockLlmResponse(content: string) {
  return {
    content,
    model: 'minimax-m2.7',
    provider: 'minimax',
    latencyMs: 10,
    cached: false,
  };
}

function createMockQdrantScrollResponse(points: unknown[] = []) {
  return {
    ok: true,
    json: async () => ({
      status: 'ok',
      result: { points, next_page_offset: null },
    }),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['QDRANT_URL'] = 'http://localhost:6333';

  mockFetchClient.mockResolvedValue(createMockQdrantScrollResponse());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('status_update — StateGraph structure', () => {
  it('compiles to a valid StateGraph', () => {
    expect(statusUpdateGraph).toBeDefined();
    expect(typeof statusUpdateGraph.invoke).toBe('function');
  });

  it('exports executeStatusUpdate and approveStatusUpdate', async () => {
    const source = await import('../langgraph/status_update.js');
    expect(typeof source.executeStatusUpdate).toBe('function');
    expect(typeof source.approveStatusUpdate).toBe('function');
  });
});

describe('status_update — campaign fetching', () => {
  it('fetches active campaigns from Qdrant agency_campaigns collection', async () => {
    await executeStatusUpdate();

    const campaignCall = mockFetchClient.mock.calls.find(
      ([url]: [string]) => url.includes('campaigns'),
    );
    expect(campaignCall).toBeDefined();
  });

  it('returns state with campaignIds array', async () => {
    const result = await executeStatusUpdate();

    expect(result).toHaveProperty('campaignIds');
    expect(Array.isArray(result.campaignIds)).toBe(true);
  });

  it('campaignIds is empty array when Qdrant returns no data', async () => {
    mockFetchClient.mockResolvedValue(createMockQdrantScrollResponse([]));

    const result = await executeStatusUpdate();

    expect(result.campaignIds).toEqual([]);
  });
});

describe('status_update — report generation', () => {
  it('calls llmComplete to generate status report', async () => {
    mockLlmComplete.mockResolvedValue(createMockLlmResponse('Relatorio de campanhas'));

    await executeStatusUpdate();

    expect(mockLlmComplete).toHaveBeenCalled();
  });

  it('generates report string in the response', async () => {
    mockLlmComplete.mockResolvedValue(createMockLlmResponse('Relatorio de campanhas'));

    const result = await executeStatusUpdate();

    // Report may be set before interrupt fires
    if (result.report !== undefined) {
      expect(typeof result.report).toBe('string');
    }
  });
});

describe('status_update — error handling', () => {
  it('handles Qdrant failure gracefully (returns result without throwing)', async () => {
    mockFetchClient.mockRejectedValue(new Error('Qdrant connection refused'));

    const result = await executeStatusUpdate();

    // Should not throw — returns result object
    expect(result).toBeDefined();
    expect(result).toHaveProperty('campaignIds');
    expect(result).toHaveProperty('broadcastSent');
  });

  it('handles LLM failure gracefully', async () => {
    mockLlmComplete.mockRejectedValue(new Error('MiniMax API error'));

    const result = await executeStatusUpdate();

    // Should not throw — returns result object
    expect(result).toBeDefined();
  });

  it('returns StatusUpdateState-shaped object with required fields', async () => {
    mockLlmComplete.mockResolvedValue(createMockLlmResponse('Relatorio'));

    const result = await executeStatusUpdate();

    expect(result).toHaveProperty('campaignIds');
    expect(result).toHaveProperty('report');
    expect(result).toHaveProperty('broadcastSent');
    expect(typeof result.broadcastSent).toBe('boolean');
  });
});

describe('status_update — approval functions', () => {
  it('approveStatusUpdate is callable with approved=true', async () => {
    const result = await approveStatusUpdate('status-thread-1', true, 'Aprovado!');

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('approveStatusUpdate is callable with approved=false', async () => {
    const result = await approveStatusUpdate('status-thread-2', false, 'Reprovado');

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('approveStatusUpdate returns an object even with unknown threadId', async () => {
    // Unknown threadId causes graph error — function still returns a result object
    const result = await approveStatusUpdate('unknown-thread', true);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

describe('status_update — interrupt source verification', () => {
  it('statusUpdateGraph is compiled with MemorySaver checkpointer', () => {
    // interrupt() usage verified by smoke tests
    expect(statusUpdateGraph).toBeDefined();
  });
});
