"""
HCE v2.1 — Memory Manager
SQLite-based short-term memory for context sessions.
Phase 1 fix: detect corruption on bootstrap, recreate, log warn.
"""
import os
import sqlite3
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("MEMORY_DB_PATH", "/tmp/hce_memory.db")


def _is_db_corrupt(conn: sqlite3.Connection) -> bool:
    """Validate that the connection points to a real SQLite database."""
    try:
        conn.execute("PRAGMA schema_version")
        return False
    except (sqlite3.DatabaseError, sqlite3.OperationalError):
        return True


def _bootstrap_db(path: str) -> sqlite3.Connection:
    """Open or recreate the SQLite database, handling corruption gracefully."""
    # If file exists but is not a valid DB, detect and recreate
    if os.path.exists(path):
        try:
            conn = sqlite3.connect(path, check_same_thread=False)
            if _is_db_corrupt(conn):
                raise sqlite3.DatabaseError("Corrupt database detected by PRAGMA")
            return conn
        except (sqlite3.DatabaseError, sqlite3.OperationalError) as exc:
            logger.warning(
                "SQLite database at %s is corrupt or invalid (%s). "
                "Recreating from scratch.",
                path,
                exc,
            )
            try:
                os.remove(path)
            except OSError as rm_exc:
                logger.error("Failed to remove corrupt DB %s: %s", path, rm_exc)
                raise

    # Fresh create
    conn = sqlite3.connect(path, check_same_thread=False)
    return conn


_conn = _bootstrap_db(DB_PATH)
_cursor = _conn.cursor()

_cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        context TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
""")
_conn.commit()


def get_session(sid: str) -> dict | None:
    row = _cursor.execute(
        "SELECT id, context, updated_at FROM sessions WHERE id = ?", (sid,)
    ).fetchone()
    if not row:
        return None
    return {"id": row[0], "context": row[1], "updated_at": row[2]}


def save_session(sid: str, context: str) -> None:
    _cursor.execute(
        """
        INSERT INTO sessions (id, context) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET context=excluded.context,
                                      updated_at=strftime('%s', 'now')
        """,
        (sid, context),
    )
    _conn.commit()
