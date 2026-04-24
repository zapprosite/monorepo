import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setFetch } from '../utils/fetch-client.js';
import {
  buildDatasetName,
  parseDatasetName,
  createDataset,
  ragSearch,
  ragRetrieve,
  type DatasetConfig,
} from './rag-instance-organizer.js';

// ---------------------------------------------------------------------------
// Helper: mock fetch via injectable fetchClient
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  });
  setFetch(mockFetch as typeof globalThis.fetch);
});

afterEach(() => {
  // No cleanup needed
});

// ---------------------------------------------------------------------------
// buildDatasetName
// ---------------------------------------------------------------------------

describe('buildDatasetName', () => {
  it('builds name from app only', () => {
    const config: DatasetConfig = { app: 'hermes', description: 'Hermes knowledge base' };
    expect(buildDatasetName(config)).toBe('hermes');
  });

  it('builds name from app with lowercase', () => {
    const config: DatasetConfig = { app: 'HERMES', description: 'Hermes knowledge base' };
    expect(buildDatasetName(config)).toBe('hermes');
  });

  it('builds name with lead dimension', () => {
    const config: DatasetConfig = { app: 'painel', lead: 'alfa', description: 'Painel lead alfa' };
    expect(buildDatasetName(config)).toBe('painel-lead-alfa');
  });

  it('builds name with lead dimension lowercase', () => {
    const config: DatasetConfig = { app: 'HVACR', lead: 'XYZ', description: 'HVAC-R lead xyz' };
    expect(buildDatasetName(config)).toBe('hvacr-lead-xyz');
  });

  it('matches hermes-knowledge pattern', () => {
    const config: DatasetConfig = { app: 'hermes', description: 'Hermes Agent knowledge base' };
    expect(buildDatasetName(config)).toBe('hermes');
  });

  it('matches painel-lead-alfa-knowledge pattern', () => {
    const config: DatasetConfig = { app: 'painel', lead: 'alfa', description: 'Painel lead alfa' };
    expect(buildDatasetName(config)).toBe('painel-lead-alfa');
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
    const config: DatasetConfig = { app: 'hermes', description: 'some description' };
    const name = buildDatasetName(config);
    const parsed = parseDatasetName(name);
    expect(parsed?.app).toBe('hermes');
    expect(parsed?.lead).toBeUndefined();
  });

  it('is inverse of buildDatasetName for app+lead', () => {
    const config: DatasetConfig = { app: 'painel', lead: 'alfa', description: 'some description' };
    const name = buildDatasetName(config);
    const parsed = parseDatasetName(name);
    expect(parsed?.app).toBe('painel');
    expect(parsed?.lead).toBe('alfa');
  });

  it('parses monorepo-lead-will pattern', () => {
    const result = parseDatasetName('monorepo-lead-will');
    expect(result).toEqual({ app: 'monorepo', lead: 'will', description: '' });
  });
});

// ---------------------------------------------------------------------------
// createDataset
// ---------------------------------------------------------------------------

describe('createDataset', () => {
  it('returns null when Trieve API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    const config: DatasetConfig = { app: 'test', description: 'test dataset' };
    const result = await createDataset(config);
    expect(result).toBeNull();
  });

  it('returns dataset data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'ds_123', name: 'test' }),
    });

    const config: DatasetConfig = { app: 'test', description: 'test dataset' };
    const result = await createDataset(config);
    expect(result).toEqual({ id: 'ds_123', name: 'test' });
  });

  it('uses TRIEVE_URL and TRIEVE_API_KEY from env', async () => {
    const originalUrl = process.env['TRIEVE_URL'];
    const originalKey = process.env['TRIEVE_API_KEY'];
    process.env['TRIEVE_URL'] = 'https://trieve.example.com';
    process.env['TRIEVE_API_KEY'] = 'test-key';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'ds_456', name: 'env-test' }),
    });

    const config: DatasetConfig = { app: 'envtest', description: 'env test' };
    await createDataset(config);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://trieve.example.com/api/v1/datasets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'ApiKey test-key',
        }),
      }),
    );

    process.env['TRIEVE_URL'] = originalUrl;
    process.env['TRIEVE_API_KEY'] = originalKey;
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const config: DatasetConfig = { app: 'test', description: 'test' };
    const result = await createDataset(config);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ragSearch
// ---------------------------------------------------------------------------

describe('ragSearch', () => {
  it('returns empty array when search fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: vi.fn().mockResolvedValue('Search failed'),
    });

    const results = await ragSearch('ds_123', 'test query', 5);
    expect(results).toEqual([]);
  });

  it('returns mapped results on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            chunk: {
              id: 'chunk_1',
              chunk_html: 'Test content',
              metadata: { type: 'doc' },
            },
            score: 0.95,
          },
          {
            chunk: {
              id: 'chunk_2',
              chunk_html: 'More content',
              metadata: { type: 'doc' },
            },
            score: 0.88,
          },
        ],
      }),
    });

    const results = await ragSearch('ds_123', 'test query', 5);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: 'chunk_1',
      content: 'Test content',
      score: 0.95,
      metadata: { type: 'doc' },
    });
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const results = await ragSearch('ds_123', 'test', 5);
    expect(results).toEqual([]);
  });

  it('uses hybrid search type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragSearch('ds_123', 'query', 3);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          query: 'query',
          limit: 3,
          search_type: 'hybrid',
          highlight_results: true,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ragRetrieve
// ---------------------------------------------------------------------------

describe('ragRetrieve', () => {
  it('returns empty array when TRIEVE_DEFAULT_DATASET_ID is not set', async () => {
    const original = process.env['TRIEVE_DEFAULT_DATASET_ID'];
    delete process.env['TRIEVE_DEFAULT_DATASET_ID'];

    const results = await ragRetrieve('test query', 5);
    expect(results).toEqual([]);

    process.env['TRIEVE_DEFAULT_DATASET_ID'] = original;
  });

  it('calls ragSearch with default dataset id', async () => {
    const original = process.env['TRIEVE_DEFAULT_DATASET_ID'];
    process.env['TRIEVE_DEFAULT_DATASET_ID'] = 'ds_default';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });

    await ragRetrieve('test query', 3);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'TR-Dataset': 'ds_default',
        }),
      }),
    );

    process.env['TRIEVE_DEFAULT_DATASET_ID'] = original;
  });
});
