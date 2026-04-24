import { fetchClient } from '../utils/fetch-client.js';

const MCP_HOST = process.env['MCP_POSTGRES_HOST'] ?? 'localhost';
const MCP_PORT = process.env['MCP_POSTGRES_PORT'] ?? '4017';
const MCP_URL = `http://${MCP_HOST}:${MCP_PORT}/tools/call`;

export interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  default?: string;
}

export interface SchemaResult {
  schema: string;
  created: boolean;
}

export interface SchemaInfo {
  schema: string;
  lead?: string;
}

export interface TableInfo {
  table: string;
  schema: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface WriteResult {
  affectedRows: number;
}

async function callMcpTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
  const response = await fetchClient(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: arguments_ }),
  });

  if (!response.ok) {
    throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

function buildCreateSchemaArgs(app: string, lead?: string): Record<string, unknown> {
  const args: Record<string, unknown> = { app };
  if (lead !== undefined) args['lead'] = lead;
  return args;
}

function buildDropSchemaArgs(app: string, lead?: string): Record<string, unknown> {
  const args: Record<string, unknown> = { app };
  if (lead !== undefined) args['lead'] = lead;
  return args;
}

function buildListSchemasArgs(app?: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (app !== undefined) args['app'] = app;
  return args;
}

function buildCreateTableArgs(app: string, lead: string | undefined, table: string, columns: ColumnDef[]): Record<string, unknown> {
  const args: Record<string, unknown> = { app, table, columns };
  if (lead !== undefined) args['lead'] = lead;
  return args;
}

function buildListTablesArgs(app: string, lead?: string): Record<string, unknown> {
  const args: Record<string, unknown> = { app };
  if (lead !== undefined) args['lead'] = lead;
  return args;
}

function buildQueryArgs(sql: string, limit?: number): Record<string, unknown> {
  const args: Record<string, unknown> = { sql };
  if (limit !== undefined) args['limit'] = limit;
  return args;
}

function buildWriteArgs(sql: string): Record<string, unknown> {
  return { sql };
}

function buildCreateIndexArgs(app: string, lead: string | undefined, table: string, index: string, columns: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = { app, table, index, columns };
  if (lead !== undefined) args['lead'] = lead;
  return args;
}

export async function createSchema(app: string, lead?: string): Promise<SchemaResult> {
  const result = await callMcpTool('create_schema', buildCreateSchemaArgs(app, lead));
  return result as SchemaResult;
}

export async function dropSchema(app: string, lead?: string): Promise<void> {
  await callMcpTool('drop_schema', buildDropSchemaArgs(app, lead));
}

export async function listSchemas(app?: string): Promise<SchemaInfo[]> {
  const result = await callMcpTool('list_schemas', buildListSchemasArgs(app));
  return result as SchemaInfo[];
}

export async function createTable(app: string, lead: string | undefined, table: string, columns: ColumnDef[]): Promise<void> {
  await callMcpTool('create_table', buildCreateTableArgs(app, lead, table, columns));
}

export async function listTables(app: string, lead?: string): Promise<TableInfo[]> {
  const result = await callMcpTool('list_tables', buildListTablesArgs(app, lead));
  return result as TableInfo[];
}

export async function query(sql: string, limit?: number): Promise<QueryResult> {
  const result = await callMcpTool('query', buildQueryArgs(sql, limit));
  return result as QueryResult;
}

export async function write(sql: string): Promise<WriteResult> {
  const result = await callMcpTool('write', buildWriteArgs(sql));
  return result as WriteResult;
}

export async function createIndex(app: string, lead: string | undefined, table: string, index: string, columns: string[]): Promise<void> {
  await callMcpTool('create_index', buildCreateIndexArgs(app, lead, table, index, columns));
}
