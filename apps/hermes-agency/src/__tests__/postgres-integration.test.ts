// Anti-hardcoded: all config via process.env
// PostgreSQL MCP Integration Tests — Schema/table operations via MCP server :4017
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetch for MCP server HTTP calls
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

// ---------------------------------------------------------------------------
// Import after mock setup
// ---------------------------------------------------------------------------

import {
  createSchema,
  dropSchema,
  listSchemas,
  createTable,
  listTables,
  query,
  write,
  createIndex,
  type ColumnDef,
  type SchemaResult,
  type SchemaInfo,
  type TableInfo,
  type QueryResult,
  type WriteResult,
} from '../postgres/mcp-client.js';

// ---------------------------------------------------------------------------
// MCP server configuration
// ---------------------------------------------------------------------------

describe('MCP server configuration', () => {
  it('uses MCP_POSTGRES_HOST and MCP_POSTGRES_PORT from env', async () => {
    const originalHost = process.env['MCP_POSTGRES_HOST'];
    const originalPort = process.env['MCP_POSTGRES_PORT'];

    process.env['MCP_POSTGRES_HOST'] = 'custom-host';
    process.env['MCP_POSTGRES_PORT'] = '9999';

    // Re-import to pick up new env values (module is already loaded, so we test the URL construction)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await listSchemas();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://custom-host:9999/tools/call',
      expect.any(Object),
    );

    process.env['MCP_POSTGRES_HOST'] = originalHost;
    process.env['MCP_POSTGRES_PORT'] = originalPort;
  });

  it('defaults to localhost:4017 when env not set', async () => {
    const originalHost = process.env['MCP_POSTGRES_HOST'];
    const originalPort = process.env['MCP_POSTGRES_PORT'];

    delete process.env['MCP_POSTGRES_HOST'];
    delete process.env['MCP_POSTGRES_PORT'];

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await listSchemas();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4017/tools/call',
      expect.any(Object),
    );

    process.env['MCP_POSTGRES_HOST'] = originalHost;
    process.env['MCP_POSTGRES_PORT'] = originalPort;
  });
});

// ---------------------------------------------------------------------------
// createSchema
// ---------------------------------------------------------------------------

describe('createSchema', () => {
  it('calls MCP tool create_schema with app name', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ schema: 'hermes_app', created: true }),
    });

    const result = await createSchema('hermes_app');

    expect(result).toEqual({ schema: 'hermes_app', created: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4017/tools/call',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'create_schema',
          arguments: { app: 'hermes_app' },
        }),
      }),
    );
  });

  it('includes optional lead parameter', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ schema: 'painel_alfa', created: true }),
    });

    await createSchema('painel', 'alfa');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'create_schema',
          arguments: { app: 'painel', lead: 'alfa' },
        }),
      }),
    );
  });

  it('throws on MCP server error', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    await expect(createSchema('test_app')).rejects.toThrow('MCP server error: 500 Internal Server Error');
  });

  it('throws on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(createSchema('test_app')).rejects.toThrow('Connection refused');
  });
});

// ---------------------------------------------------------------------------
// dropSchema
// ---------------------------------------------------------------------------

describe('dropSchema', () => {
  it('calls MCP tool drop_schema', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await dropSchema('hermes_app');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'drop_schema',
          arguments: { app: 'hermes_app' },
        }),
      }),
    );
  });

  it('includes lead when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await dropSchema('painel', 'alfa');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'drop_schema',
          arguments: { app: 'painel', lead: 'alfa' },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// listSchemas
// ---------------------------------------------------------------------------

describe('listSchemas', () => {
  it('returns array of schemas', async () => {
    const mockSchemas: SchemaInfo[] = [
      { schema: 'hermes' },
      { schema: 'painel' },
      { schema: 'hvacr' },
    ];
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockSchemas),
    });

    const result = await listSchemas();

    expect(result).toEqual(mockSchemas);
    expect(result).toHaveLength(3);
  });

  it('filters by app when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([{ schema: 'hermes' }]),
    });

    await listSchemas('hermes');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'list_schemas',
          arguments: { app: 'hermes' },
        }),
      }),
    );
  });

  it('returns empty array when no schemas exist', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    const result = await listSchemas();

    expect(result).toEqual([]);
  });

  it('includes lead info in schema response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([{ schema: 'painel_alfa', lead: 'alfa' }]),
    });

    const result = await listSchemas('painel');

    expect(result[0].lead).toBe('alfa');
  });
});

// ---------------------------------------------------------------------------
// createTable
// ---------------------------------------------------------------------------

describe('createTable', () => {
  it('calls MCP tool create_table with columns', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    const columns: ColumnDef[] = [
      { name: 'id', type: 'SERIAL', primaryKey: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' },
    ];

    await createTable('hermes', undefined, 'clients', columns);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'create_table',
          arguments: {
            app: 'hermes',
            table: 'clients',
            columns,
          },
        }),
      }),
    );
  });

  it('includes lead in arguments when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    const columns: ColumnDef[] = [{ name: 'id', type: 'SERIAL', primaryKey: true }];

    await createTable('painel', 'alfa', 'campaigns', columns);

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.lead).toBe('alfa');
  });

  it('passes column metadata correctly', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    const columns: ColumnDef[] = [
      { name: 'email', type: 'VARCHAR(255)', unique: true, nullable: false },
      { name: 'status', type: 'VARCHAR(50)', default: "'active'" },
    ];

    await createTable('app', undefined, 'users', columns);

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.columns).toEqual(columns);
  });
});

// ---------------------------------------------------------------------------
// listTables
// ---------------------------------------------------------------------------

describe('listTables', () => {
  it('returns array of tables for an app', async () => {
    const mockTables: TableInfo[] = [
      { table: 'clients', schema: 'hermes' },
      { table: 'campaigns', schema: 'hermes' },
    ];
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockTables),
    });

    const result = await listTables('hermes');

    expect(result).toEqual(mockTables);
    expect(result).toHaveLength(2);
  });

  it('filters by lead when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([{ table: 'campaigns', schema: 'painel_alfa' }]),
    });

    await listTables('painel', 'alfa');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'list_tables',
          arguments: { app: 'painel', lead: 'alfa' },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

describe('query', () => {
  it('calls MCP tool query with SQL', async () => {
    const mockResult: QueryResult = {
      columns: ['id', 'name', 'email'],
      rows: [
        { id: 1, name: 'Client A', email: 'a@example.com' },
        { id: 2, name: 'Client B', email: 'b@example.com' },
      ],
      rowCount: 2,
    };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    });

    const result = await query('SELECT id, name, email FROM clients LIMIT 10');

    expect(result).toEqual(mockResult);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'query',
          arguments: { sql: 'SELECT id, name, email FROM clients LIMIT 10' },
        }),
      }),
    );
  });

  it('applies limit parameter', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    });

    await query('SELECT * FROM clients', 50);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'query',
          arguments: { sql: 'SELECT * FROM clients', limit: 50 },
        }),
      }),
    );
  });

  it('handles query with no limit specified', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    });

    await query('SELECT * FROM clients');

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.limit).toBeUndefined();
  });

  it('returns proper QueryResult structure', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
      }),
    });

    const result = await query('SELECT * FROM test');

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.rows).toEqual([{ id: 1, name: 'Test' }]);
    expect(result.rowCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

describe('write', () => {
  it('calls MCP tool write for INSERT/UPDATE/DELETE', async () => {
    const mockResult: WriteResult = { affectedRows: 1 };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    });

    const result = await write("INSERT INTO clients (name) VALUES ('New Client')");

    expect(result).toEqual(mockResult);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'write',
          arguments: { sql: "INSERT INTO clients (name) VALUES ('New Client')" },
        }),
      }),
    );
  });

  it('returns affectedRows count', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ affectedRows: 5 }),
    });

    const result = await write('DELETE FROM clients WHERE status = inactive');

    expect(result.affectedRows).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// createIndex
// ---------------------------------------------------------------------------

describe('createIndex', () => {
  it('calls MCP tool create_index with correct arguments', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await createIndex('hermes', undefined, 'clients', 'idx_clients_email', ['email']);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: 'create_index',
          arguments: {
            app: 'hermes',
            table: 'clients',
            index: 'idx_clients_email',
            columns: ['email'],
          },
        }),
      }),
    );
  });

  it('includes lead when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await createIndex('painel', 'alfa', 'campaigns', 'idx_alfa_name', ['name']);

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.lead).toBe('alfa');
  });

  it('handles multi-column indexes', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await createIndex('app', undefined, 'orders', 'idx_orders_composite', ['client_id', 'created_at']);

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.columns).toEqual(['client_id', 'created_at']);
  });
});

// ---------------------------------------------------------------------------
// Schema naming conventions
// ---------------------------------------------------------------------------

describe('schema naming conventions', () => {
  it('uses app name directly in create_schema', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ schema: 'hermes', created: true }),
    });

    await createSchema('hermes');

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.app).toBe('hermes');
  });

  it('combines app and lead when lead provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ schema: 'painel_alfa', created: true }),
    });

    await createSchema('painel', 'alfa');

    const call = fetchSpy.mock.calls[0];
    const args = JSON.parse(call[1].body).arguments;
    expect(args.app).toBe('painel');
    expect(args.lead).toBe('alfa');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws on connection refused', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(listSchemas()).rejects.toThrow('Connection refused');
  });

  it('throws on MCP server 503', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('Service Unavailable'),
    });

    await expect(query('SELECT 1')).rejects.toThrow('MCP server error: 503 Service Unavailable');
  });

  it('throws on MCP server 401 (unauthorized)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });

    await expect(createSchema('test')).rejects.toThrow('MCP server error: 401 Unauthorized');
  });

  it('throws on invalid JSON response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      text: vi.fn().mockResolvedValue('not valid json'),
    });

    await expect(query('SELECT 1')).rejects.toThrow();
  });

  it('handles timeout errors', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('AbortError: The user aborted a request'));

    await expect(listTables('app')).rejects.toThrow();
  });
});
