#!/usr/bin/env python3
# Anti-hardcoded: all config via process.env
# MCP Server for PostgreSQL Schema Management
# Organizes schemas by app/lead dimension
#
# Usage:
#   MCP_POSTGRES_HOST=localhost MCP_POSTGRES_PORT=5432 python3 server.py

import os
import sys
import json
import uuid
from dataclasses import dataclass, asdict
from typing import Optional
from contextlib import contextmanager
from decimal import Decimal

# ---------------------------------------------------------------------------
# Imports — pg8000 for pure Python PostgreSQL driver
# ---------------------------------------------------------------------------

try:
    import pg8000
    from pg8000 import Connection as PGConnection
except ImportError:
    print("[mcp-postgres] pg8000 not installed — run: pip install pg8000")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration (all via process.env — anti-hardcoded pattern HC-33)
# ---------------------------------------------------------------------------

POSTGRES_HOST = os.environ.get("MCP_POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.environ.get("MCP_POSTGRES_DB_PORT", os.environ.get("MCP_POSTGRES_PORT", "5432")))
POSTGRES_USER = os.environ.get("MCP_POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("MCP_POSTGRES_PASSWORD", "")
POSTGRES_DB = os.environ.get("MCP_POSTGRES_DB", "postgres")

# Optional: default schema pattern
DEFAULT_SCHEMA_PATTERN = os.environ.get("MCP_POSTGRES_DEFAULT_SCHEMA", "public")


@dataclass
class SchemaInfo:
    name: str
    owner: str
    tables: int
    size_bytes: int


@dataclass
class TableInfo:
    schema: str
    name: str
    owner: str
    rows: int
    size_bytes: int


@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool
    default: Optional[str]
    is_primary_key: bool


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------


class PostgresConnectionManager:
    """Manages PostgreSQL connections with app/lead schema routing."""

    def __init__(self):
        self._connection: Optional[PGConnection] = None

    @contextmanager
    def connect(self):
        """Yield a connection, auto-commit on success."""
        conn = pg8000.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            database=POSTGRES_DB,
        )
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def execute(self, query: str, params=None):
        """Execute a query and return results."""
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params if params is not None else ())
            try:
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return {"columns": columns, "rows": rows}
            except pg8000.exceptions.NoData:
                return {"columns": [], "rows": []}

    def execute_one(self, query: str, params=None):
        """Execute a query, return first row or None."""
        result = self.execute(query, params)
        if result["rows"]:
            return dict(zip(result["columns"], result["rows"][0]))
        return None

    def execute_write(self, query: str, params=None) -> int:
        """Execute INSERT/UPDATE/DELETE, return rows affected."""
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params if params is not None else ())
            return cursor.rowcount


# ---------------------------------------------------------------------------
# Schema Organizer
# ---------------------------------------------------------------------------


class SchemaOrganizer:
    """
    Organizes PostgreSQL schemas by app/lead dimension.

    Naming convention:
      {app}[_{lead}]?

    Examples:
      hermes              — Hermes app, no lead
      hermes_will         — Hermes app, lead=will
      painel_alfa         — Painel app, lead=alfa
      hvacr_xyz           — HVAC-R app, lead=xyz
      governance          — Ops/governance
    """

    def __init__(self, conn_mgr: PostgresConnectionManager):
        self.conn = conn_mgr

    # ------------------------------------------------------------------
    # Schema CRUD
    # ------------------------------------------------------------------

    def create_schema(self, app: str, lead: Optional[str] = None) -> dict:
        """Create a schema for a given app/lead dimension."""
        schema_name = self._build_schema_name(app, lead)

        # Check if schema already exists
        existing = self.conn.execute_one(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
            (schema_name,),
        )
        if existing:
            return {"status": "exists", "schema": schema_name}

        # Create schema
        self.conn.execute_write(f'CREATE SCHEMA "{schema_name}"')

        # Grant usage to public (optional)
        try:
            self.conn.execute_write(f'GRANT USAGE ON SCHEMA "{schema_name}" TO public')
        except Exception:
            pass

        return {"status": "created", "schema": schema_name}

    def drop_schema(self, app: str, lead: Optional[str] = None, cascade: bool = True) -> dict:
        """Drop a schema and all its objects."""
        schema_name = self._build_schema_name(app, lead)
        cascade_sql = "CASCADE" if cascade else ""
        self.conn.execute_write(f'DROP SCHEMA "{schema_name}" {cascade_sql}')
        return {"status": "dropped", "schema": schema_name}

    def list_schemas(self, app: Optional[str] = None) -> list[SchemaInfo]:
        """
        List all schemas. Optionally filter by app prefix.
        Shows table count and total size.
        """
        if app:
            query = """
                SELECT
                    s.schema_name,
                    s.schema_owner,
                    COUNT(t.table_name) AS tables,
                    COALESCE(SUM(pg_catalog.pg_total_relation_size(s.schema_name || '.' || t.table_name)), 0) AS size_bytes
                FROM information_schema.schemata s
                LEFT JOIN information_schema.tables t ON t.table_schema = s.schema_name AND t.table_type = 'BASE TABLE'
                WHERE s.schema_name LIKE %s || '%%'
                GROUP BY s.schema_name, s.schema_owner
                ORDER BY s.schema_name
            """
            params = (app,)
        else:
            query = """
                SELECT
                    s.schema_name,
                    s.schema_owner,
                    COUNT(t.table_name) AS tables,
                    COALESCE(SUM(pg_catalog.pg_total_relation_size(s.schema_name || '.' || t.table_name)), 0) AS size_bytes
                FROM information_schema.schemata s
                LEFT JOIN information_schema.tables t ON t.table_schema = s.schema_name AND t.table_type = 'BASE TABLE'
                WHERE s.schema_name NOT IN ('pg_catalog', 'information_schema', 'extensions')
                GROUP BY s.schema_name, s.schema_owner
                ORDER BY s.schema_name
            """
            params = None

        result = self.conn.execute(query, params)
        return [
            SchemaInfo(
                name=row[0],
                owner=row[1],
                tables=row[2],
                size_bytes=row[3],
            )
            for row in result["rows"]
        ]

    def get_current_schema(self) -> str:
        """Get current search_path schema."""
        row = self.conn.execute_one("SELECT current_schema()")
        return row["current_schema"] if row else "public"

    # ------------------------------------------------------------------
    # Table Management
    # ------------------------------------------------------------------

    def create_table(
        self,
        app: str,
        lead: Optional[str],
        table_name: str,
        columns: list[dict],  # [{name, type, nullable, default, primary_key}]
        if_not_exists: bool = False,
    ) -> dict:
        """
        Create a table in the app/lead schema.

        columns: [{name: str, type: str, nullable: bool, default: str|None, primary_key: bool}]
        Example: [{name: "id", type: "SERIAL", nullable: False, default: None, primary_key: True},
                 {name: "data", type: "JSONB", nullable: True, default: None, primary_key: False}]
        """
        schema_name = self._build_schema_name(app, lead)
        self._ensure_schema_exists(schema_name)

        # Build column definitions
        col_defs: list[str] = []
        for col in columns:
            col_sql = f'"{col["name"]}" {col["type"]}'
            if not col.get("nullable", True):
                col_sql += " NOT NULL"
            if col.get("default"):
                col_sql += f' DEFAULT {col["default"]}'
            col_defs.append(col_sql)

        # Add primary key constraint if specified
        pk_cols = [c["name"] for c in columns if c.get("primary_key")]
        if pk_cols:
            col_defs.append(f'PRIMARY KEY ({", ".join(f'"{c}"' for c in pk_cols)})')

        ine_sql = "IF NOT EXISTS" if if_not_exists else ""
        full_table = f"{schema_name}.{table_name}"
        query = f'CREATE TABLE {ine_sql} "{schema_name}"."{table_name}" ({", ".join(col_defs)})'

        self.conn.execute_write(query)
        return {"status": "created", "table": full_table}

    def drop_table(self, app: str, lead: Optional[str], table_name: str) -> dict:
        """Drop a table from the app/lead schema."""
        schema_name = self._build_schema_name(app, lead)
        self.conn.execute_write(f'DROP TABLE "{schema_name}"."{table_name}"')
        return {"status": "dropped", "table": f"{schema_name}.{table_name}"}

    def list_tables(self, app: str, lead: Optional[str] = None) -> list[TableInfo]:
        """List all tables in an app/lead schema."""
        schema_name = self._build_schema_name(app, lead)
        query = """
            SELECT
                t.table_schema,
                t.table_name,
                t.table_owner,
                COALESCE(c.reltuples, 0)::bigint AS rows,
                pg_catalog.pg_total_relation_size(t.table_schema || '.' || t.table_name) AS size_bytes
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace::regnamespace::text = t.table_schema
            WHERE t.table_schema = %s AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
        """
        result = self.conn.execute(query, (schema_name,))
        return [
            TableInfo(
                schema=row[0],
                name=row[1],
                owner=row[2],
                rows=row[3],
                size_bytes=row[4],
            )
            for row in result["rows"]
        ]

    def describe_table(self, app: str, lead: Optional[str], table_name: str) -> list[ColumnInfo]:
        """Get column metadata for a table."""
        schema_name = self._build_schema_name(app, lead)
        query = """
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                COALESCE(pk.column_name IS NOT NULL, FALSE) AS is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.table_schema, ku.table_name, ku.column_name
                FROM information_schema.key_column_usage ku
                JOIN information_schema.table_constraints tc
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON pk.table_schema = c.table_schema
                AND pk.table_name = c.table_name
                AND pk.column_name = c.column_name
            WHERE c.table_schema = %s AND c.table_name = %s
            ORDER BY c.ordinal_position
        """
        result = self.conn.execute(query, (schema_name, table_name))
        return [
            ColumnInfo(
                name=row[0],
                type=row[1],
                nullable=(row[2] == "YES"),
                default=row[3],
                is_primary_key=bool(row[4]),
            )
            for row in result["rows"]
        ]

    # ------------------------------------------------------------------
    # Query Execution
    # ------------------------------------------------------------------

    def query(self, sql: str, limit: int = 100) -> dict:
        """
        Execute a read query. Safe for SELECT only.
        Results are limited to prevent memory issues.
        """
        sql = sql.strip()
        if not sql.upper().startswith("SELECT"):
            return {"error": "Only SELECT queries allowed via query() method"}

        if limit:
            if "LIMIT" not in sql.upper():
                sql = f"{sql} LIMIT {limit}"

        result = self.conn.execute(sql)
        return {
            "columns": result["columns"],
            "rows": [dict(zip(result["columns"], row)) for row in result["rows"]],
            "count": len(result["rows"]),
        }

    def write(self, sql: str, params: Optional[dict] = None) -> dict:
        """Execute a write query (INSERT/UPDATE/DELETE)."""
        sql = sql.strip()
        if sql.upper().startswith("SELECT"):
            return {"error": "Use query() for SELECT statements"}

        rows = self.conn.execute_write(sql, params)
        return {"status": "ok", "rows_affected": rows}

    # ------------------------------------------------------------------
    # Index Management
    # ------------------------------------------------------------------

    def create_index(
        self,
        app: str,
        lead: Optional[str],
        table_name: str,
        index_name: str,
        columns: list[str],
        unique: bool = False,
        if_not_exists: bool = False,
    ) -> dict:
        """Create an index on a table."""
        schema_name = self._build_schema_name(app, lead)
        ine_sql = "IF NOT EXISTS" if if_not_exists else ""
        unique_sql = "UNIQUE" if unique else ""
        cols_sql = ", ".join(f'"{c}"' for c in columns)
        full_index = f"{schema_name}.{index_name}"

        query = f"""
            CREATE {unique_sql} INDEX {ine_sql}
            "{schema_name}"."{index_name}"
            ON "{schema_name}"."{table_name}" ({cols_sql})
        """
        self.conn.execute_write(query)
        return {"status": "created", "index": full_index}

    def list_indexes(self, app: str, lead: Optional[str] = None) -> list[dict]:
        """List all indexes in an app/lead schema."""
        schema_name = self._build_schema_name(app, lead)
        query = """
            SELECT
                idx.relname AS index_name,
                am.amname AS index_method,
                attr.attname AS column_name,
                idx.indisunique AS is_unique,
                idx.indisprimary AS is_primary
            FROM pg_index idx
            JOIN pg_class tab ON tab.oid = idx.indrelid
            JOIN pg_namespace ns ON ns.oid = tab.relnamespace
            JOIN pg_class idx ON idx.oid = idx.indexrelid
            JOIN pg_am am ON am.oid = idx.relam
            JOIN pg_indexчение attr ON attr.indexrelid = idx.oid
            WHERE ns.nspname = %s
            ORDER BY idx.relname, attr.attnum
        """
        # Simplified query
        result = self.conn.execute(query, (schema_name,))
        return [
            {"index": row[0], "method": row[1], "column": row[2], "unique": row[3], "primary": row[4]}
            for row in result["rows"]
        ]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_schema_name(self, app: str, lead: Optional[str] = None) -> str:
        """Build schema name from app and optional lead."""
        app = app.lower().replace("-", "_")
        if lead:
            lead = lead.lower().replace("-", "_")
            return f"{app}_{lead}"
        return app

    def _ensure_schema_exists(self, schema_name: str) -> None:
        """Ensure schema exists, create if not."""
        existing = self.conn.execute_one(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
            (schema_name,),
        )
        if not existing:
            self.conn.execute_write(f'CREATE SCHEMA "{schema_name}"')


# ---------------------------------------------------------------------------
# MCP Protocol (JSON-RPC 2.0 over SSE)
# ---------------------------------------------------------------------------
# Tools are called via POST /tools/call with:
#   {"name": "tool_name", "arguments": {...}}
# Results are returned via SSE /events stream
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "create_schema",
        "description": "Create a new PostgreSQL schema for an app/lead dimension. Example: create_schema(app='hermes', lead='will') creates schema 'hermes_will'",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string", "description": "App identifier (e.g. 'hermes', 'painel', 'hvacr')"},
                "lead": {"type": "string", "description": "Optional lead identifier (e.g. 'will', 'alfa')"},
            },
            "required": ["app"],
        },
    },
    {
        "name": "drop_schema",
        "description": "Drop a schema and all its objects (CASCADE).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
                "cascade": {"type": "boolean", "default": True},
            },
            "required": ["app"],
        },
    },
    {
        "name": "list_schemas",
        "description": "List all schemas. Filter by app prefix.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string", "description": "Optional app prefix filter"},
            },
        },
    },
    {
        "name": "create_table",
        "description": "Create a table in an app/lead schema. Define columns as array of {name, type, nullable, default, primary_key}.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
                "table_name": {"type": "string"},
                "columns": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "type": {"type": "string"},
                            "nullable": {"type": "boolean"},
                            "default": {"type": "string"},
                            "primary_key": {"type": "boolean"},
                        },
                        "required": ["name", "type"],
                    },
                },
            },
            "required": ["app", "table_name", "columns"],
        },
    },
    {
        "name": "drop_table",
        "description": "Drop a table from an app/lead schema.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
                "table_name": {"type": "string"},
            },
            "required": ["app", "table_name"],
        },
    },
    {
        "name": "list_tables",
        "description": "List all tables in an app/lead schema with row counts and sizes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
            },
            "required": ["app"],
        },
    },
    {
        "name": "describe_table",
        "description": "Get column metadata for a table (name, type, nullable, default, primary_key).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
                "table_name": {"type": "string"},
            },
            "required": ["app", "table_name"],
        },
    },
    {
        "name": "query",
        "description": "Execute a SELECT query. Returns columns and rows (capped at limit).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string"},
                "limit": {"type": "integer", "default": 100},
            },
            "required": ["sql"],
        },
    },
    {
        "name": "write",
        "description": "Execute INSERT/UPDATE/DELETE. Returns rows affected.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string"},
            },
            "required": ["sql"],
        },
    },
    {
        "name": "create_index",
        "description": "Create an index on a table.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {"type": "string"},
                "lead": {"type": "string"},
                "table_name": {"type": "string"},
                "index_name": {"type": "string"},
                "columns": {"type": "array", "items": {"type": "string"}},
                "unique": {"type": "boolean"},
                "if_not_exists": {"type": "boolean"},
            },
            "required": ["app", "table_name", "index_name", "columns"],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool Handlers
# ---------------------------------------------------------------------------

conn_mgr = PostgresConnectionManager()
organizer = SchemaOrganizer(conn_mgr)


def handle_tool(name: str, arguments: dict) -> dict:
    """Route tool call to handler."""
    if name == "create_schema":
        return organizer.create_schema(
            app=arguments["app"],
            lead=arguments.get("lead"),
        )
    elif name == "drop_schema":
        return organizer.drop_schema(
            app=arguments["app"],
            lead=arguments.get("lead"),
            cascade=arguments.get("cascade", True),
        )
    elif name == "list_schemas":
        return [asdict(s) for s in organizer.list_schemas(arguments.get("app"))]
    elif name == "create_table":
        return organizer.create_table(
            app=arguments["app"],
            lead=arguments.get("lead"),
            table_name=arguments["table_name"],
            columns=arguments["columns"],
            if_not_exists=arguments.get("if_not_exists", False),
        )
    elif name == "drop_table":
        return organizer.drop_table(
            app=arguments["app"],
            lead=arguments.get("lead"),
            table_name=arguments["table_name"],
        )
    elif name == "list_tables":
        return [asdict(t) for t in organizer.list_tables(arguments["app"], arguments.get("lead"))]
    elif name == "describe_table":
        return [asdict(c) for c in organizer.describe_table(
            arguments["app"],
            arguments.get("lead"),
            arguments["table_name"],
        )]
    elif name == "query":
        return organizer.query(arguments["sql"], arguments.get("limit", 100))
    elif name == "write":
        return organizer.write(arguments["sql"], arguments.get("params"))
    elif name == "create_index":
        return organizer.create_index(
            app=arguments["app"],
            lead=arguments.get("lead"),
            table_name=arguments["table_name"],
            index_name=arguments["index_name"],
            columns=arguments["columns"],
            unique=arguments.get("unique", False),
            if_not_exists=arguments.get("if_not_exists", False),
        )
    else:
        return {"error": f"Unknown tool: {name}"}


# ---------------------------------------------------------------------------
# Simple HTTP Server (SSE-compatible for Claude Code MCP)
# ---------------------------------------------------------------------------

from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.parse


class MCPHandler(BaseHTTPRequestHandler):
    """Minimal MCP HTTP handler — supports tools/list and tools/call."""

    def log_message(self, format, *args):
        print(f"[mcp-postgres] {args[0]}")

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/tools/list":
            self.send_json({"tools": TOOLS})
        elif self.path == "/health":
            self.send_json({"status": "ok", "service": "mcp-postgres"})
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        if self.path.startswith("/tools/call"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body)
                name = payload.get("name", "")
                arguments = payload.get("arguments", {})
                result = handle_tool(name, arguments)
                self.send_json({"result": result})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        else:
            self.send_json({"error": "Not found"}, 404)


def run_server(port: int = 4017):
    """Run the MCP HTTP server."""
    server = HTTPServer(("0.0.0.0", port), MCPHandler)
    print(f"[mcp-postgres] Listening on :{port}")
    server.serve_forever()


if __name__ == "__main__":
    PORT = int(os.environ.get("MCP_POSTGRES_PORT", "4017"))
    run_server(PORT)
