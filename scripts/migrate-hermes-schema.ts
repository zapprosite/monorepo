#!/usr/bin/env npx tsx
/**
 * migrate-hermes-schema.ts
 *
 * Creates the hermes schema with all core tables, indexes, and optional seed data.
 *
 * Usage:
 *   npx tsx scripts/migrate-hermes-schema.ts --schema hermes_will --seed
 *   npx tsx scripts/migrate-hermes-schema.ts --schema hermes
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string | null;
  primary_key?: boolean;
}

interface TableDefinition {
  name: string;
  columns: Column[];
}

interface MigrationOptions {
  schema: string;
  seed: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

// ---------------------------------------------------------------------------
// Table Definitions
// ---------------------------------------------------------------------------

const CORE_TABLES: TableDefinition[] = [
  {
    name: "clients",
    columns: [
      { name: "id", type: "UUID", primary_key: true, default: "gen_random_uuid()" },
      { name: "name", type: "TEXT", nullable: false },
      { name: "plan", type: "TEXT", default: "'basic'" },
      { name: "health_score", type: "INT", default: "100" },
      { name: "chat_id", type: "BIGINT" },
      { name: "created_at", type: "TIMESTAMPTZ", default: "now()" },
      { name: "metadata", type: "JSONB" },
    ],
  },
  {
    name: "campaigns",
    columns: [
      { name: "id", type: "UUID", primary_key: true, default: "gen_random_uuid()" },
      { name: "client_id", type: "UUID", references: "clients(id)" },
      { name: "name", type: "TEXT", nullable: false },
      { name: "status", type: "TEXT", default: "'draft'" },
      { name: "created_at", type: "TIMESTAMPTZ", default: "now()" },
    ],
  },
  {
    name: "tasks",
    columns: [
      { name: "id", type: "UUID", primary_key: true, default: "gen_random_uuid()" },
      { name: "campaign_id", type: "UUID", references: "campaigns(id)" },
      { name: "title", type: "TEXT", nullable: false },
      { name: "status", type: "TEXT", default: "'pending'" },
      { name: "assigned_to", type: "TEXT" },
      { name: "due_date", type: "TIMESTAMPTZ" },
      { name: "priority", type: "INT", default: "0" },
    ],
  },
  {
    name: "deliverables",
    columns: [
      { name: "id", type: "UUID", primary_key: true, default: "gen_random_uuid()" },
      { name: "campaign_id", type: "UUID", references: "campaigns(id)" },
      { name: "task_id", type: "UUID", references: "tasks(id)" },
      { name: "name", type: "TEXT", nullable: false },
      { name: "type", type: "TEXT", default: "'report'" },
      { name: "status", type: "TEXT", default: "'draft'" },
      { name: "url", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMPTZ", default: "now()" },
    ],
  },
  {
    name: "metrics",
    columns: [
      { name: "id", type: "UUID", primary_key: true, default: "gen_random_uuid()" },
      { name: "campaign_id", type: "UUID", references: "campaigns(id)" },
      { name: "metric_date", type: "DATE" },
      { name: "impressions", type: "INT", default: "0" },
      { name: "clicks", type: "INT", default: "0" },
      { name: "conversions", type: "INT", default: "0" },
      { name: "spend", type: "DECIMAL(10,2)", default: "0" },
      { name: "revenue", type: "DECIMAL(10,2)", default: "0" },
      { name: "created_at", type: "TIMESTAMPTZ", default: "now()" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Index Definitions
// ---------------------------------------------------------------------------

interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  partial?: string;
}

const INDEXES: IndexDefinition[] = [
  // B-tree indexes
  { name: "idx_clients_chat_id", table: "clients", columns: ["chat_id"] },
  { name: "idx_campaigns_client_id", table: "campaigns", columns: ["client_id"] },
  { name: "idx_campaigns_status", table: "campaigns", columns: ["status"] },
  { name: "idx_tasks_campaign_id", table: "tasks", columns: ["campaign_id"] },
  { name: "idx_tasks_status", table: "tasks", columns: ["status"] },
  { name: "idx_deliverables_campaign_id", table: "deliverables", columns: ["campaign_id"] },
  { name: "idx_deliverables_task_id", table: "deliverables", columns: ["task_id"] },
  { name: "idx_metrics_campaign_id", table: "metrics", columns: ["campaign_id"] },
  { name: "idx_metrics_date", table: "metrics", columns: ["metric_date"] },
  // GIN index
  { name: "idx_clients_metadata", table: "clients", columns: ["metadata"], partial: "metadata IS NOT NULL" },
  // Partial indexes
  { name: "idx_campaigns_active", table: "campaigns", columns: ["status"], partial: "status = 'active'" },
  { name: "idx_tasks_pending", table: "tasks", columns: ["status"], partial: "status = 'pending'" },
];

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const SEED_SQL = `
-- Seed clients
INSERT INTO {schema}.clients (id, name, plan, health_score, chat_id, metadata) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Acme Corp', 'enterprise', 95, 123456789, '{"industry": "tech", "source": "referral"}'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Beta Inc', 'pro', 80, 987654321, '{"industry": "retail"}'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Gamma LLC', 'basic', 60, 5551234567, '{"industry": "finance"}');

-- Seed campaigns
INSERT INTO {schema}.campaigns (id, client_id, name, status, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Q1 Launch', 'active', now() - interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Summer Sale', 'draft', now() - interval '7 days'),
  ('33333333-3333-3333-3333-333333333333', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Brand Awareness', 'active', now() - interval '14 days'),
  ('44444444-4444-4444-4444-444444444444', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Lead Gen', 'paused', now() - interval '60 days');

-- Seed tasks
INSERT INTO {schema}.tasks (id, campaign_id, title, status, assigned_to, due_date, priority) VALUES
  ('aaaa1111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'Design landing page', 'done', 'designer@acme', now() + interval '5 days', 2),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', '11111111-1111-1111-1111-111111111111', 'Write copy', 'in_progress', 'writer@acme', now() + interval '3 days', 1),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', '33333333-3333-3333-3333-333333333333', 'Setup tracking', 'pending', 'dev@beta', now() + interval '10 days', 0),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', '44444444-4444-4444-4444-444444444444', 'Review analytics', 'pending', 'analyst@gamma', now() + interval '7 days', 1);

-- Seed deliverables
INSERT INTO {schema}.deliverables (id, campaign_id, task_id, name, type, status, url) VALUES
  ('dddd1111-dddd-1111-dddd-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'Homepage Mockup', 'design', 'approved', 'https://s3.amazonaws.com/bucket/mockup.png'),
  ('dddd2222-dddd-2222-dddd-222222222222', '11111111-1111-1111-1111-111111111111', 'aaaa2222-aaaa-2222-aaaa-222222222222', 'Hero Copy v1', 'content', 'review', 'https://docs.google.com/doc/copy1'),
  ('dddd3333-dddd-3333-dddd-333333333333', '33333333-3333-3333-3333-333333333333', NULL, 'Tracking Report', 'report', 'draft', NULL);

-- Seed metrics
INSERT INTO {schema}.metrics (id, campaign_id, metric_date, impressions, clicks, conversions, spend, revenue) VALUES
  ('mmmm1111-mmmm-1111-mmmm-111111111111', '11111111-1111-1111-1111-111111111111', current_date - interval '7 days', 50000, 1200, 45, 250.00, 1500.00),
  ('mmmm2222-mmmm-2222-mmmm-222222222222', '11111111-1111-1111-1111-111111111111', current_date - interval '6 days', 52000, 1350, 52, 260.00, 1700.00),
  ('mmmm3333-mmmm-3333-mmmm-333333333333', '33333333-3333-3333-3333-333333333333', current_date - interval '3 days', 100000, 3000, 80, 500.00, 2400.00),
  ('mmmm4444-mmmm-4444-mmmm-444444444444', '33333333-3333-3333-3333-333333333333', current_date - interval '2 days', 110000, 3200, 95, 550.00, 2800.00);
`;

// ---------------------------------------------------------------------------
// PostgreSQL Connection (pg)
// ---------------------------------------------------------------------------

async function getDbConnection(opts: MigrationOptions) {
  const { default: pg } = await import("pg");
  const { Client } = pg;

  const client = new Client({
    host: opts.host ?? process.env.MCP_POSTGRES_HOST ?? "localhost",
    port: opts.port ?? parseInt(process.env.MCP_POSTGRES_PORT ?? "5432"),
    user: opts.user ?? process.env.MCP_POSTGRES_USER ?? "postgres",
    password: opts.password ?? process.env.MCP_POSTGRES_PASSWORD ?? "",
    database: opts.database ?? process.env.MCP_POSTGRES_DB ?? "postgres",
  });

  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------
// SQL Builders
// ---------------------------------------------------------------------------

function buildCreateTableSQL(table: TableDefinition, schema: string): string {
  const colDefs = table.columns.map((col) => {
    let sql = `"${col.name}" ${col.type}`;
    if (col.default) {
      sql += ` DEFAULT ${col.default}`;
    }
    if (!col.nullable) {
      sql += " NOT NULL";
    }
    return sql;
  });

  const pkCols = table.columns.filter((c) => c.primary_key);
  if (pkCols.length > 0) {
    colDefs.push(`PRIMARY KEY (${pkCols.map((c) => `"${c.name}"`).join(", ")})`);
  }

  // Add foreign key constraints
  table.columns.forEach((col) => {
    if (col.references) {
      colDefs.push(`REFERENCES ${col.references}`);
    }
  });

  return `CREATE TABLE "${schema}"."${table.name}" (${colDefs.join(", ")})`;
}

function buildCreateIndexSQL(index: IndexDefinition, schema: string): string {
  const cols = index.columns.map((c) => `"${c}"`).join(", ");
  let sql = `CREATE`;

  if (index.unique) {
    sql += " UNIQUE";
  }

  sql += ` INDEX IF NOT EXISTS "${schema}"."${index.name}" ON "${schema}"."${index.table}" (${cols})`;

  if (index.partial) {
    sql += ` WHERE ${index.partial}`;
  }

  return sql;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function migrate(opts: MigrationOptions) {
  console.log(`\n=== PostgreSQL Migration ===`);
  console.log(`Schema: ${opts.schema}`);
  console.log(`Seed: ${opts.seed ? "yes" : "no"}\n`);

  const client = await getDbConnection(opts);

  try {
    // Step 1: Create schema
    console.log(`[1/4] Creating schema "${opts.schema}"...`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${opts.schema}"`);
    console.log(`  Schema created.`);

    // Step 2: Create tables
    console.log(`[2/4] Creating tables...`);
    for (const table of CORE_TABLES) {
      const sql = buildCreateTableSQL(table, opts.schema);
      console.log(`  Creating table "${table.name}"...`);
      await client.query(sql);
      console.log(`  Table "${table.name}" created.`);
    }

    // Step 3: Create indexes
    console.log(`[3/4] Creating indexes...`);
    for (const index of INDEXES) {
      const sql = buildCreateIndexSQL(index, opts.schema);
      console.log(`  Creating index "${index.name}"...`);
      await client.query(sql);
      console.log(`  Index "${index.name}" created.`);
    }

    // Step 4: Seed data
    if (opts.seed) {
      console.log(`[4/4] Seeding data...`);
      const seedSql = SEED_SQL.replace(/{schema}/g, opts.schema);
      await client.query(seedSql);
      console.log(`  Data seeded.`);
    } else {
      console.log(`[4/4] Skipping seed (--no-seed)`);
    }

    console.log(`\n=== Migration Complete ===\n`);

    // Verify
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [opts.schema]
    );
    console.log(`Tables in "${opts.schema}":`);
    rows.forEach((r) => console.log(`  - ${r.table_name}`));
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const opts: MigrationOptions = {
    schema: "hermes",
    seed: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--schema" && i + 1 < args.length) {
      opts.schema = args[++i];
    } else if (arg === "--seed") {
      opts.seed = true;
    } else if (arg === "--host" && i + 1 < args.length) {
      opts.host = args[++i];
    } else if (arg === "--port" && i + 1 < args.length) {
      opts.port = parseInt(args[++i]);
    } else if (arg === "--user" && i + 1 < args.length) {
      opts.user = args[++i];
    } else if (arg === "--password" && i + 1 < args.length) {
      opts.password = args[++i];
    } else if (arg === "--database" && i + 1 < args.length) {
      opts.database = args[++i];
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
migrate-hermes-schema.ts

Creates the hermes schema with all core tables, indexes, and optional seed data.

Usage:
  npx tsx scripts/migrate-hermes-schema.ts [options]

Options:
  --schema <name>    Schema name (default: hermes)
  --seed             Seed with sample data (default: false)
  --host <host>      PostgreSQL host
  --port <port>      PostgreSQL port
  --user <user>      PostgreSQL user
  --password <pass>  PostgreSQL password
  --database <db>    PostgreSQL database
  --help             Show this help

Examples:
  npx tsx scripts/migrate-hermes-schema.ts --schema hermes_will --seed
  npx tsx scripts/migrate-hermes-schema.ts --schema hermes
  npx tsx scripts/migrate-hermes-schema.ts --schema hermes_alfa --seed --host 192.168.1.100
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs();
migrate(opts).catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
