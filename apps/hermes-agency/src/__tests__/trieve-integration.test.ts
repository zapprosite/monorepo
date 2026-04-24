// Anti-hardcoded: all config via process.env
// Trieve RAG Integration Tests — Dataset create/index/search with 120 chunk limit
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetch for Trieve API
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.spyOn>;

const originalEnv = { ...process.env };

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  });
  // Reset env to original state before each test
  process.env = { ...originalEnv };
});

afterEach(() => {
  fetchSpy?.mockRestore();
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Import after mock setup
// ---------------------------------------------------------------------------

import {
  buildDatasetName,
  parseDatasetName,
  createDataset,
  indexDocument,
  ragSearch,
  listDatasets,
  ragRetrieve,
  type DatasetConfig,
  type RagDocument,
} from '../skills/rag-instance-organizer.js';

// ---------------------------------------------------------------------------
// buildDatasetName
// ---------------------------------------------------------------------------

describe('buildDatasetName', () => {
  it('builds name from app only', () => {
    const config: DatasetConfig = { app: 'hermes', description: 'Hermes knowledge base' };
    expect(buildDatasetName(config)).toBe('hermes');
  });

  it('builds name with lowercase conversion', () => {
    const config: DatasetConfig = { app: 'HERMES', description: 'test' };
    expect(buildDatasetName(config)).toBe('hermes');
  });

  it('builds name with lead dimension', () => {
    const config: DatasetConfig = { app: 'painel', lead: 'alfa', description: 'Painel lead alfa' };
    expect(buildDatasetName(config)).toBe('painel-lead-alfa');
  });

  it('builds name with lead lowercase', () => {
    const config: DatasetConfig = { app: 'HVACR', lead: 'XYZ', description: 'HVAC-R lead xyz' };
    expect(buildDatasetName(config)).toBe('hvacr-lead-xyz');
  });

  it('matches expected patterns from DATASET_TEMPLATES', () => {
    expect(buildDatasetName({ app: 'hermes', description: '' })).toBe('hermes');
    expect(buildDatasetName({ app: 'hermes', lead: 'memory', description: '' })).toBe('hermes-lead-memory');
    expect(buildDatasetName({ app: 'monorepo', description: '' })).toBe('monorepo');
    expect(buildDatasetName({ app: 'hvacr', description: '' })).toBe('hvacr');
    expect(buildDatasetName({ app: 'ops', lead: 'governance', description: '' })).toBe('ops-lead-governance');
  });
});

// ---------------------------------------------------------------------------
// parseDatasetName
// ---------------------------------------------------------------------------

describe('parseDatasetName', () => {
  it('parses app only', () => {
    const result = parseDatasetName('hermes');
    expect(result).toEqual({ app: 'hermes', lead: undefined, description: '' });
  });

  it('parses app with lead', () => {
    const result = parseDatasetName('painel-lead-alfa');
    expect(result).toEqual({ app: 'painel', lead: 'alfa', description: '' });
  });

  it('returns null for empty string', () => {
    expect(parseDatasetName('')).toBeNull();
  });

  it('is inverse of buildDatasetName for app only', () => {
    const config: DatasetConfig = { app: 'hermes', description: 'test' };
    const name = buildDatasetName(config);
    const parsed = parseDatasetName(name);
    expect(parsed?.app).toBe('hermes');
    expect(parsed?.lead).toBeUndefined();
  });

  it('is inverse of buildDatasetName for app+lead', () => {
    const config: DatasetConfig = { app: 'painel', lead: 'alfa', description: 'test' };
    const name = buildDatasetName(config);
    const parsed = parseDatasetName(name);
    expect(parsed?.app).toBe('painel');
    expect(parsed?.lead).toBe('alfa');
  });

  it('parses monorepo-lead-will pattern', () => {
    const result = parseDatasetName('monorepo-lead-will');
    expect(result).toEqual({ app: 'monorepo', lead: 'will', description: '' });
  });

  it('handles ops-lead-governance pattern', () => {
    const result = parseDatasetName('ops-lead-governance');
    expect(result).toEqual({ app: 'ops', lead: 'governance', description: '' });
  });
});

// ---------------------------------------------------------------------------
// createDataset
// ---------------------------------------------------------------------------

describe('createDataset', () => {
  it('creates dataset with correct name via Trieve API', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'ds_123', name: 'hermes-knowledge' }),
    });

    const config: DatasetConfig = { app: 'hermes', description: 'Hermes knowledge base' };
    const result = await createDataset(config);

    expect(result).toEqual({ id: 'ds_123', name: 'hermes-knowledge' });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/datasets');
    const body = JSON.parse(options.body);
    expect(body.name).toBe('hermes');
    expect(body.description).toBe('Hermes knowledge base');
  });

  it('returns null when API call fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    const config: DatasetConfig = { app: 'test', description: 'test' };
    const result = await createDataset(config);

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const config: DatasetConfig = { app: 'test', description: 'test' };
    const result = await createDataset(config);

    expect(result).toBeNull();
  });

  it('uses TRIEVE_URL and TRIEVE_API_KEY from env', async () => {
    process.env['TRIEVE_URL'] = 'https://custom.trieve.ai';
    process.env['TRIEVE_API_KEY'] = 'secret-key';

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'ds_456', name: 'custom' }),
    });

    await createDataset({ app: 'custom', description: 'custom dataset' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://custom.trieve.ai/api/v1/datasets');

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'ApiKey secret-key',
      }),
    );
  });

  it('includes chunking strategy when specified', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'ds_heading', name: 'hermes' }),
    });

    await createDataset({
      app: 'hermes',
      description: 'test',
      chunkingStrategy: 'heading',
    });

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.settings).toEqual({ chunking_strategy: 'heading' });
  });
});

// ---------------------------------------------------------------------------
// indexDocument with batch indexing (120 chunk limit)
// ---------------------------------------------------------------------------

describe('indexDocument — batch indexing', () => {
  it('processes documents within 120 chunk limit in single batch', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 50 }),
    });

    const documents: RagDocument[] = Array.from({ length: 50 }, (_, i) => ({
      content: `Document ${i} content`,
      metadata: { type: 'doc', index: i },
    }));

    const result = await indexDocument('ds_123', documents);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('splits documents exceeding 120 chunks into multiple batches', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 120 }),
    });

    const documents: RagDocument[] = Array.from({ length: 250 }, (_, i) => ({
      content: `Document ${i} content`,
      metadata: { type: 'doc', index: i },
    }));

    const result = await indexDocument('ds_123', documents);

    expect(result).toBe(true);
    // 250 docs / 120 per batch = 3 batches (120 + 120 + 10)
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Verify first batch
    const [firstUrl, firstOptions] = fetchSpy.mock.calls[0];
    expect(firstUrl).toContain('/api/v1/chunks');
    const firstBody = JSON.parse(firstOptions.body);
    expect(firstBody.chunks).toHaveLength(120);

    // Verify second batch
    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(secondBody.chunks).toHaveLength(120);

    // Verify third batch (remaining 10)
    const thirdBody = JSON.parse(fetchSpy.mock.calls[2][1].body);
    expect(thirdBody.chunks).toHaveLength(10);
  });

  it('sends correct TR-Dataset header for each batch', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 120 }),
    });

    const documents: RagDocument[] = Array.from({ length: 250 }, (_, i) => ({
      content: `Doc ${i}`,
      metadata: { type: 'doc' },
    }));

    await indexDocument('ds_hermes_test', documents);

    for (const [, options] of fetchSpy.mock.calls) {
      expect(options.headers).toEqual(
        expect.objectContaining({
          'TR-Dataset': 'ds_hermes_test',
        }),
      );
    }
  });

  it('returns false when any batch fails', async () => {
    // First batch succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 120 }),
    });
    // Second batch fails
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Server error'),
    });

    const documents: RagDocument[] = Array.from({ length: 200 }, (_, i) => ({
      content: `Doc ${i}`,
      metadata: { type: 'doc' },
    }));

    const result = await indexDocument('ds_fail', documents);

    expect(result).toBe(false);
  });

  it('handles exact 120 chunk boundary', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 120 }),
    });

    const documents: RagDocument[] = Array.from({ length: 120 }, (_, i) => ({
      content: `Doc ${i}`,
      metadata: { type: 'doc' },
    }));

    const result = await indexDocument('ds_exact', documents);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('handles 121 chunks (1 over limit = 2 batches)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 1 }),
    });

    const documents: RagDocument[] = Array.from({ length: 121 }, (_, i) => ({
      content: `Doc ${i}`,
      metadata: { type: 'doc' },
    }));

    const result = await indexDocument('ds_over', documents);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('maps document content to chunk_html', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 1 }),
    });

    const documents: RagDocument[] = [
      {
        content: 'This is the document content',
        metadata: { type: 'manual', page: 1 },
      },
    ];

    await indexDocument('ds_content', documents);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.chunks[0].chunk_html).toBe('This is the document content');
    expect(body.chunks[0].metadata).toEqual({ type: 'manual', page: 1 });
  });

  it('sets tag_set from metadata type', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ successful: 1 }),
    });

    const documents: RagDocument[] = [
      { content: 'Test', metadata: { type: 'guide' } },
    ];

    await indexDocument('ds_tag', documents);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.chunks[0].tag_set).toBe('guide');
  });
});

// ---------------------------------------------------------------------------
// ragSearch with hybrid query
// ---------------------------------------------------------------------------

describe('ragSearch', () => {
  it('returns empty array when search fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      text: vi.fn().mockResolvedValue('Search failed'),
    });

    const results = await ragSearch('ds_123', 'test query', 5);

    expect(results).toEqual([]);
  });

  it('returns mapped results on success', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            chunk: {
              id: 'chunk_1',
              chunk_html: 'Campaign for summer sale',
              metadata: { type: 'campaign', page: 1 },
            },
            score: 0.95,
          },
          {
            chunk: {
              id: 'chunk_2',
              chunk_html: 'Marketing analytics report',
              metadata: { type: 'report', page: 3 },
            },
            score: 0.88,
          },
        ],
      }),
    });

    const results = await ragSearch('ds_123', 'marketing campaign', 5);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: 'chunk_1',
      content: 'Campaign for summer sale',
      score: 0.95,
      metadata: { type: 'campaign', page: 1 },
    });
    expect(results[1]).toEqual({
      id: 'chunk_2',
      content: 'Marketing analytics report',
      score: 0.88,
      metadata: { type: 'report', page: 3 },
    });
  });

  it('returns empty array on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const results = await ragSearch('ds_123', 'test', 5);

    expect(results).toEqual([]);
  });

  it('uses hybrid search type', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragSearch('ds_123', 'query', 3);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.search_type).toBe('hybrid');
    expect(body.highlight_results).toBe(true);
    expect(body.limit).toBe(3);
  });

  it('sends correct TR-Dataset header', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragSearch('ds_hermes', 'test query', 5);

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({
        'TR-Dataset': 'ds_hermes',
      }),
    );
  });

  it('handles missing score in response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            chunk: {
              id: 'chunk_no_score',
              chunk_html: 'Content without score',
              metadata: {},
            },
            // no score field
          },
        ],
      }),
    });

    const results = await ragSearch('ds_123', 'query', 5);

    expect(results[0].score).toBe(0);
  });

  it('handles missing results field in response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}), // no results field
    });

    const results = await ragSearch('ds_123', 'query', 5);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listDatasets
// ---------------------------------------------------------------------------

describe('listDatasets', () => {
  it('returns array of datasets on success', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([
        { id: 'ds_1', name: 'hermes-knowledge', description: 'Hermes KB' },
        { id: 'ds_2', name: 'painel-lead-alfa', description: 'Painel alfa' },
      ]),
    });

    const results = await listDatasets();

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('hermes-knowledge');
  });

  it('returns empty array when API fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      text: vi.fn().mockResolvedValue('Failed'),
    });

    const results = await listDatasets();

    expect(results).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const results = await listDatasets();

    expect(results).toEqual([]);
  });

  it('uses TRIEVE_URL from env', async () => {
    process.env['TRIEVE_URL'] = 'https://custom.trieve.ai:9999';

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await listDatasets();

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://custom.trieve.ai:9999/api/v1/datasets');
  });
});

// ---------------------------------------------------------------------------
// ragRetrieve (default dataset fallback)
// ---------------------------------------------------------------------------

describe('ragRetrieve', () => {
  it('returns empty array when TRIEVE_DEFAULT_DATASET_ID is not set', async () => {
    delete process.env['TRIEVE_DEFAULT_DATASET_ID'];

    const results = await ragRetrieve('test query', 5);

    expect(results).toEqual([]);
  });

  it('calls ragSearch with default dataset id', async () => {
    process.env['TRIEVE_DEFAULT_DATASET_ID'] = 'ds_default';

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragRetrieve('test query', 3);

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({
        'TR-Dataset': 'ds_default',
      }),
    );
  });

  it('passes topK as limit to ragSearch', async () => {
    process.env['TRIEVE_DEFAULT_DATASET_ID'] = 'ds_limit_test';

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragRetrieve('query', 7);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.limit).toBe(7);
  });
});
