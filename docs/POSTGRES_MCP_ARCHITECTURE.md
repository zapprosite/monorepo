# PostgreSQL MCP Architecture — Hermes Agency

**Service:** MCP PostgreSQL Server (`:4017`)
**Location:** `/srv/monorepo/mcps/mcp-postgres/server.py`
**Purpose:** Schema management for Hermes Agency multi-tenant database

---

## Overview

The PostgreSQL MCP provides a structured way to manage schemas organized by **app** and **lead** dimensions. Each schema follows the naming convention `{app}[_{lead}]` and contains a standardized set of tables for CRM-like operations.

## Schema Naming Convention

| Schema | App | Lead | Use Case |
|--------|-----|------|----------|
| `hermes` | hermes | — | Default Hermes agency schema |
| `hermes_will` | hermes | will | Will's Hermes instance |
| `painel_alfa` | painel | alfa | Alfa's painel instance |
| `hvacr_xyz` | hvacr | xyz | HVAC-R business |
| `ops_governance` | ops | governance | Ops governance |

---

## Core Tables per Schema

All schemas share the same table structure:

### `clients`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Client name |
| `plan` | TEXT | basic, pro, enterprise |
| `health_score` | INT | Default 100 |
| `chat_id` | BIGINT | Telegram/signal chat ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `metadata` | JSONB | Flexible metadata |

### `campaigns`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_id` | UUID | FK to clients |
| `name` | TEXT | Campaign name |
| `status` | TEXT | draft, active, paused, completed |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `tasks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `title` | TEXT | Task title |
| `status` | TEXT | pending, in_progress, done |
| `assigned_to` | TEXT | Assignee identifier |
| `due_date` | TIMESTAMPTZ | Due date |
| `priority` | INT | Priority level (0=low) |

### `deliverables`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `task_id` | UUID | FK to tasks (nullable) |
| `name` | TEXT | Deliverable name |
| `type` | TEXT | report, content, design, code |
| `status` | TEXT | draft, review, approved, delivered |
| `url` | TEXT | External URL (S3, GDrive, etc.) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `metric_date` | DATE | Date of metric |
| `impressions` | INT | Ad impressions |
| `clicks` | INT | Click count |
| `conversions` | INT | Conversions |
| `spend` | DECIMAL(10,2) | Money spent |
| `revenue` | DECIMAL(10,2) | Revenue generated |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

---

## Indexes

### B-tree Indexes
- `idx_clients_chat_id` on `clients(chat_id)`
- `idx_campaigns_client_id` on `campaigns(client_id)`
- `idx_campaigns_status` on `campaigns(status)`
- `idx_tasks_campaign_id` on `tasks(campaign_id)`
- `idx_tasks_status` on `tasks(status)`
- `idx_deliverables_campaign_id` on `deliverables(campaign_id)`
- `idx_metrics_campaign_id` on `metrics(campaign_id)`
- `idx_metrics_date` on `metrics(metric_date)`

### GIN Indexes
- `idx_clients_metadata` on `clients(metadata)` — JSONB GIN

### Partial Indexes
- `idx_campaigns_active` on `campaigns(status)` WHERE `status = 'active'`
- `idx_tasks_pending` on `tasks(status)` WHERE `status = 'pending'`

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_schema` | Create schema `{app}_{lead?}` |
| `drop_schema` | Drop schema (CASCADE) |
| `list_schemas` | List schemas, optionally filter by app |
| `create_table` | Create table with column definitions |
| `drop_table` | Drop table |
| `list_tables` | List tables in schema |
| `describe_table` | Get column metadata |
| `query` | Execute SELECT (100 row limit) |
| `write` | Execute INSERT/UPDATE/DELETE |
| `create_index` | Create B-tree/GIN/partial index |

---

## PostgreSQL → Qdrant Synchronization

When records are created in PostgreSQL, they are同步到 Qdrant for vector similarity search:

### Qdrant Collections

| PostgreSQL Table | Qdrant Collection | Purpose |
|-----------------|-------------------|---------|
| `clients` | `agency_clients` | Client similarity search |
| `campaigns` | `agency_campaigns` | Campaign similarity search |
| `tasks` | `agency_tasks` | Task search |

### Sync Trigger
- **Client created** → upsert to `agency_clients` with client_id as payload
- **Campaign created** → upsert to `agency_campaigns` with campaign_id as payload
- **Task created** → upsert to `agency_tasks` with task_id as payload

---

## Backup Strategy

| Aspect | Details |
|--------|---------|
| Daily Dump | `pg_dump` at 3:00 AM |
| PITR | WAL archiving enabled |
| Retention | 7 daily, 4 weekly, 12 monthly |
| Destination | `/srv/backups/postgres/` |
| RTO | < 1 hour |
| RPO | < 24 hours (daily) |

### Backup Script Location
`/srv/monorepo/scripts/backup.sh`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_POSTGRES_HOST` | localhost | PostgreSQL host |
| `MCP_POSTGRES_PORT` | 5432 | PostgreSQL port |
| `MCP_POSTGRES_USER` | postgres | Database user |
| `MCP_POSTGRES_PASSWORD` | — | Database password |
| `MCP_POSTGRES_DB` | postgres | Database name |
| `MCP_POSTGRES_DEFAULT_SCHEMA` | public | Default schema |

---

## Usage Example

```typescript
// Via MCP protocol
const result = await mcpPostgres.create_schema({ app: "hermes", lead: "will" });
// Creates schema "hermes_will"

const tables = await mcpPostgres.list_tables({ app: "hermes", lead: "will" });
// Returns all tables in hermes_will schema
```

---

## Migration Script

See `/srv/monorepo/scripts/migrate-hermes-schema.ts` for automated schema setup.

```bash
# Create hermes schema with sample data
npx tsx scripts/migrate-hermes-schema.ts --schema hermes_will --seed

# Create without seeding
npx tsx scripts/migrate-hermes-schema.ts --schema hermes
```
