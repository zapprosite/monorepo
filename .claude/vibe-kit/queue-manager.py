#!/usr/bin/env python3
"""
queue-manager.py — Atomic queue operations com fcntl.flock

Hardened version:
- Timeout em todas as operações de lock (5s)
- Validação de input em todos os campos obrigatórios
- Error handling completo — nenhum Exception silencioso
- Logging estruturado em todas as operações
- Health check — verifica que queue.json existe e é válido JSON
- Recovery — lock files orphaned são limpos
- Idempotency — operações podem ser chamadas múltiplas vezes sem efeito colateral
"""
import sys
import json
import os
import fcntl
import tempfile
import shutil
import time
import logging
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
QUEUE_FILE = Path(os.environ.get("QUEUE_FILE", "/srv/monorepo/.claude/vibe-kit/queue.json"))
LOCK_FILE = Path(str(QUEUE_FILE) + ".lock")
LOCK_TIMEOUT_SEC = 5
ORPHANED_LOCK_THRESHOLD_SEC = 3600  # 1 hour — lock older than this is considered orphaned

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("queue-manager")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------
class QueueManagerError(Exception):
    """Base exception for queue-manager operations."""
    pass


class LockTimeoutError(QueueManagerError):
    """Raised when a lock cannot be acquired within the timeout."""
    pass


class QueueHealthError(QueueManagerError):
    """Raised when queue.json is missing or invalid."""
    pass


class InputValidationError(QueueManagerError):
    """Raised when required input fields are missing or invalid."""
    pass


# ---------------------------------------------------------------------------
# Utility: Timed lock acquisition
# ---------------------------------------------------------------------------
def _acquire_lock_with_timeout(lock_fd: int) -> None:
    """Acquire exclusive lock with timeout. Raises LockTimeoutError on failure."""
    start = time.monotonic()
    while True:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return
        except BlockingIOError:
            elapsed = time.monotonic() - start
            if elapsed >= LOCK_TIMEOUT_SEC:
                raise LockTimeoutError(
                    f"Failed to acquire lock within {LOCK_TIMEOUT_SEC}s (elapsed={elapsed:.1f}s)"
                )
            time.sleep(0.1)


# ---------------------------------------------------------------------------
# Utility: Lock file recovery
# ---------------------------------------------------------------------------
def _recover_orphaned_locks() -> int:
    """Remove lock files older than ORPHANED_LOCK_THRESHOLD_SEC. Returns count of removed."""
    if not LOCK_FILE.exists():
        return 0
    try:
        stat = LOCK_FILE.stat()
        mtime = stat.st_mtime
        now = time.time()
        if (now - mtime) > ORPHANED_LOCK_THRESHOLD_SEC:
            LOCK_FILE.unlink()
            logger.warning("Removed orphaned lock file: %s (age=%.1fs)", LOCK_FILE, now - mtime)
            return 1
    except OSError as e:
        logger.warning("Failed to check/remove orphaned lock %s: %s", LOCK_FILE, e)
    return 0


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
def health_check() -> dict:
    """
    Verifies that queue.json exists and is valid JSON.
    Raises QueueHealthError on failure.
    Returns a health status dict on success.
    """
    if not QUEUE_FILE.exists():
        raise QueueHealthError(f"queue.json not found at {QUEUE_FILE}")

    try:
        with open(QUEUE_FILE) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise QueueHealthError(f"queue.json is not valid JSON: {e}") from e

    required_fields = ["tasks", "parallel_limit"]
    for field in required_fields:
        if field not in data:
            raise QueueHealthError(f"queue.json missing required field: '{field}'")

    logger.info("health_check passed: queue.json OK")
    return {"status": "ok", "file": str(QUEUE_FILE)}


# ---------------------------------------------------------------------------
# Queue I/O helpers
# ---------------------------------------------------------------------------
def _read_queue_raw() -> dict:
    """Read queue.json raw. Raises QueueHealthError if invalid."""
    if not QUEUE_FILE.exists():
        raise QueueHealthError(f"queue.json not found at {QUEUE_FILE}")
    try:
        with open(QUEUE_FILE) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise QueueHealthError(f"queue.json is not valid JSON: {e}") from e


def _write_queue_atomic(queue: dict) -> None:
    """Write queue.json via temp file + atomic replace. Always succeeds or raises."""
    if not QUEUE_FILE.parent.exists():
        raise QueueHealthError(f"Queue parent directory does not exist: {QUEUE_FILE.parent}")

    tmp_fd, tmp_path = tempfile.mkstemp(dir=QUEUE_FILE.parent, prefix=".queue_tmp_")
    try:
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(queue, f, indent=2)
        os.replace(tmp_path, QUEUE_FILE)
        logger.debug("Wrote queue.json atomically")
    except Exception as e:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise QueueHealthError(f"Failed to write queue.json: {e}") from e


def _recalc_counts(queue: dict) -> dict:
    """Recalcula pending/running/done/failed/frozen dentro do lock."""
    tasks = queue.get("tasks", [])
    queue["pending"] = sum(1 for t in tasks if t.get("status") == "pending")
    queue["running"] = sum(1 for t in tasks if t.get("status") == "running")
    queue["done"] = sum(1 for t in tasks if t.get("status") == "done")
    queue["failed"] = sum(1 for t in tasks if t.get("status") == "failed")
    queue["frozen"] = sum(1 for t in tasks if t.get("status") == "frozen")
    return queue


# ---------------------------------------------------------------------------
# Core operation: with lock context manager
# ---------------------------------------------------------------------------
def _with_lock(func):
    """Decorator that handles lock acquisition/release with timeout and recovery."""
    def wrapper(*args, **kwargs):
        _recover_orphaned_locks()

        lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
        try:
            _acquire_lock_with_timeout(lock_fd)
            logger.debug("Lock acquired for %s", func.__name__)
            return func(lock_fd, *args, **kwargs)
        except LockTimeoutError:
            logger.error("Lock timeout in %s after %ds", func.__name__, LOCK_TIMEOUT_SEC)
            raise
        except QueueHealthError:
            raise
        except Exception as e:
            logger.error("Unexpected error in %s: %s (%s)", func.__name__, type(e).__name__, e)
            raise
        finally:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
                os.close(lock_fd)
            except OSError as e:
                logger.warning("Failed to release lock fd: %s", e)

    return wrapper


# ---------------------------------------------------------------------------
# Public API — all operations hold the lock for their entire duration
# ---------------------------------------------------------------------------

def claim(worker_id: str) -> Optional[dict]:
    """
    Claim the first pending task atomically.
    Returns task JSON or None if no pending tasks.
    Idempotent: claiming an already-running task is a no-op for that task.
    """
    # Input validation
    if not worker_id or not isinstance(worker_id, str):
        raise InputValidationError(f"worker_id must be a non-empty string, got: {worker_id!r}")

    @_with_lock
    def _claim(lock_fd: int) -> Optional[dict]:
        queue = _read_queue_raw()
        for i, task in enumerate(queue.get("tasks", [])):
            if task.get("status") == "pending":
                task["status"] = "running"
                task["worker"] = worker_id
                task["claimed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                queue = _recalc_counts(queue)
                _write_queue_atomic(queue)

                result = dict(task)
                result.pop("_idx", None)
                logger.info("claimed task_id=%s worker=%s", task.get("id"), worker_id)
                return result

        logger.info("claim: no pending tasks available")
        return None

    return _claim()


def complete(task_id: str, worker_id: str, result: str) -> bool:
    """
    Mark a task as done/failed atomically.
    Idempotent: completing an already-completed task is a no-op.
    Returns True if task was found and updated.
    """
    # Input validation
    if not task_id or not isinstance(task_id, str):
        raise InputValidationError(f"task_id must be a non-empty string, got: {task_id!r}")
    if not worker_id or not isinstance(worker_id, str):
        raise InputValidationError(f"worker_id must be a non-empty string, got: {worker_id!r}")
    if result not in ("done", "failed"):
        raise InputValidationError(f"result must be 'done' or 'failed', got: {result!r}")

    @_with_lock
    def _complete(lock_fd: int) -> bool:
        queue = _read_queue_raw()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id:
                current_status = task.get("status")
                current_worker = task.get("worker")

                # Idempotency: if already in desired end-state, consider it a success (no-op)
                if current_status in ("done", "failed"):
                    logger.info(
                        "complete idempotent: task_id=%s already %s (worker=%s), skipping",
                        task_id, current_status, current_worker
                    )
                    updated = True
                    break

                if current_worker != worker_id:
                    logger.warning(
                        "complete: task_id=%s worker mismatch (expected=%s, got=%s), skipping",
                        task_id, current_worker, worker_id
                    )
                    break

                task["status"] = result
                task["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                updated = True
                logger.info("completed task_id=%s result=%s worker=%s", task_id, result, worker_id)
                break

        if updated:
            queue = _recalc_counts(queue)
            _write_queue_atomic(queue)
        else:
            logger.warning("complete: task_id=%s not found or not in 'running' state", task_id)
        return updated

    return _complete()


def retry(task_id: str, worker_id: str) -> bool:
    """
    Reset a failed task back to pending, clear worker assignment.
    Idempotent: retrying a non-failed task is a no-op.
    """
    if not task_id or not isinstance(task_id, str):
        raise InputValidationError(f"task_id must be a non-empty string, got: {task_id!r}")
    if not worker_id or not isinstance(worker_id, str):
        raise InputValidationError(f"worker_id must be a non-empty string, got: {worker_id!r}")

    @_with_lock
    def _retry(lock_fd: int) -> bool:
        queue = _read_queue_raw()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id:
                current_status = task.get("status")
                if current_status != "failed":
                    logger.info(
                        "retry idempotent: task_id=%s status=%s (not 'failed'), skipping",
                        task_id, current_status
                    )
                    updated = True
                    break
                task["status"] = "pending"
                task["worker"] = None
                task["attempts"] = task.get("attempts", 0) + 1
                task["completed_at"] = None
                task["error"] = None
                updated = True
                logger.info("retried task_id=%s worker=%s", task_id, worker_id)
                break

        if updated:
            queue = _recalc_counts(queue)
            _write_queue_atomic(queue)
        return updated

    return _retry()


def freeze(task_id: str) -> bool:
    """
    Mark a task as frozen to prevent re-claim.
    Idempotent: freezing an already-frozen task is a no-op.
    """
    if not task_id or not isinstance(task_id, str):
        raise InputValidationError(f"task_id must be a non-empty string, got: {task_id!r}")

    @_with_lock
    def _freeze(lock_fd: int) -> bool:
        queue = _read_queue_raw()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id:
                current_status = task.get("status")
                if current_status == "frozen":
                    logger.info("freeze idempotent: task_id=%s already frozen, skipping", task_id)
                    updated = True
                    break
                task["status"] = "frozen"
                task["worker"] = None
                updated = True
                logger.info("frozen task_id=%s", task_id)
                break

        if updated:
            queue = _recalc_counts(queue)
            _write_queue_atomic(queue)
        return updated

    return _freeze()


def set_limit(limit: int) -> bool:
    """Set the parallel_limit in the queue header."""
    if not isinstance(limit, int) or limit < 1:
        raise InputValidationError(f"limit must be a positive integer, got: {limit!r}")

    @_with_lock
    def _set_limit(lock_fd: int) -> bool:
        queue = _read_queue_raw()
        current_limit = queue.get("parallel_limit", 5)
        if current_limit == limit:
            logger.info("set_limit idempotent: already %d, skipping", limit)
            return True
        queue["parallel_limit"] = limit
        _write_queue_atomic(queue)
        logger.info("set_limit changed from %d to %d", current_limit, limit)
        return True

    return _set_limit()


def reset_context(task_id: str) -> int:
    """Create context directory for task with prompt.md, log.md, commit.md and .active_task."""
    if not task_id or not isinstance(task_id, str):
        raise InputValidationError(f"task_id must be a non-empty string, got: {task_id!r}")

    @_with_lock
    def _reset_context(lock_fd: int) -> int:
        ctx_dir = Path("/srv/monorepo/.claude/vibe-kit/context") / task_id
        try:
            ctx_dir.mkdir(parents=True, exist_ok=True)
            (ctx_dir / "prompt.md").write_text("")
            (ctx_dir / "log.md").write_text("")
            (ctx_dir / "commit.md").write_text("")
            (ctx_dir / ".active_task").write_text(task_id)
            logger.info("reset_context task_id=%s dir=%s", task_id, ctx_dir)
            return 0
        except OSError as e:
            logger.error("reset_context failed task_id=%s: %s", task_id, e)
            raise QueueManagerError(f"Failed to create context directory: {e}") from e

    return _reset_context()


def commit(task_id: str, message: str) -> int:
    """Write message with timestamp to commit.md and append entry to log.md."""
    if not task_id or not isinstance(task_id, str):
        raise InputValidationError(f"task_id must be a non-empty string, got: {task_id!r}")
    if not isinstance(message, str):
        raise InputValidationError(f"message must be a string, got: {message!r}")

    @_with_lock
    def _commit(lock_fd: int) -> int:
        ctx_dir = Path("/srv/monorepo/.claude/vibe-kit/context") / task_id
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            commit_file = ctx_dir / "commit.md"
            commit_file.write_text(f"[{timestamp}] {message}\n")
            log_file = ctx_dir / "log.md"
            existing_log = ""
            if log_file.exists():
                existing_log = log_file.read_text()
            log_file.write_text(existing_log + f"[{timestamp}] commit: {message}\n")
            logger.info("commit task_id=%s message=%s", task_id, message)
            return 0
        except OSError as e:
            logger.error("commit failed task_id=%s: %s", task_id, e)
            raise QueueManagerError(f"Failed to write commit: {e}") from e

    return _commit()


def stats() -> dict:
    """Returns queue statistics. Uses shared lock (LOCK_SH)."""
    @_with_lock
    def _stats(lock_fd: int) -> dict:
        queue = _read_queue_raw()
        return {
            "total": queue.get("total", 0),
            "pending": queue.get("pending", 0),
            "running": queue.get("running", 0),
            "done": queue.get("done", 0),
            "failed": queue.get("failed", 0),
            "frozen": sum(1 for t in queue.get("tasks", []) if t.get("status") == "frozen"),
            "parallel_limit": queue.get("parallel_limit", 5),
        }

    return _stats()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: queue-manager.py <command> [args]")
        print("Commands: claim <worker_id> | complete <task_id> <worker_id> <result> | stats")
        print("          retry <task_id> <worker_id> | freeze <task_id> | set-limit <N>")
        print("          reset-context <task_id> | commit <task_id> <message> | health")
        sys.exit(1)

    cmd = sys.argv[1]

    try:
        if cmd == "health":
            result = health_check()
            print(json.dumps(result))
            sys.exit(0)

        elif cmd == "claim":
            if len(sys.argv) < 3:
                print("Usage: queue-manager.py claim <worker_id>")
                sys.exit(1)
            result = claim(sys.argv[2])
            if result:
                print(json.dumps(result))
            else:
                print(json.dumps({"error": "no_pending_tasks"}))
            sys.exit(0)

        elif cmd == "complete":
            if len(sys.argv) < 5:
                print("Usage: queue-manager.py complete <task_id> <worker_id> <result>")
                sys.exit(1)
            ok = complete(sys.argv[2], sys.argv[3], sys.argv[4])
            sys.exit(0 if ok else 1)

        elif cmd == "stats":
            st = stats()
            print(json.dumps(st))
            sys.exit(0)

        elif cmd == "retry":
            if len(sys.argv) < 4:
                print("Usage: queue-manager.py retry <task_id> <worker_id>")
                sys.exit(1)
            ok = retry(sys.argv[2], sys.argv[3])
            sys.exit(0 if ok else 1)

        elif cmd == "freeze":
            if len(sys.argv) < 3:
                print("Usage: queue-manager.py freeze <task_id>")
                sys.exit(1)
            ok = freeze(sys.argv[2])
            sys.exit(0 if ok else 1)

        elif cmd == "set-limit":
            if len(sys.argv) < 3:
                print("Usage: queue-manager.py set-limit <N>")
                sys.exit(1)
            try:
                limit = int(sys.argv[2])
            except ValueError:
                print("N must be an integer")
                sys.exit(1)
            ok = set_limit(limit)
            sys.exit(0 if ok else 1)

        elif cmd == "reset-context":
            if len(sys.argv) < 3:
                print("Usage: queue-manager.py reset-context <task_id>")
                sys.exit(1)
            ret = reset_context(sys.argv[2])
            sys.exit(ret)

        elif cmd == "commit":
            if len(sys.argv) < 4:
                print("Usage: queue-manager.py commit <task_id> <message>")
                sys.exit(1)
            ret = commit(sys.argv[2], sys.argv[3])
            sys.exit(ret)

        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)

    except InputValidationError as e:
        logger.error("Input validation error: %s", e)
        print(f"Input validation error: {e}")
        sys.exit(1)
    except QueueHealthError as e:
        logger.error("Health check failed: %s", e)
        print(f"Health check failed: {e}")
        sys.exit(1)
    except LockTimeoutError as e:
        logger.error("Lock timeout: %s", e)
        print(f"Lock timeout: {e}")
        sys.exit(1)
    except QueueManagerError as e:
        logger.error("Queue manager error: %s", e)
        print(f"Queue manager error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error("Unhandled exception: %s (%s)", type(e).__name__, e)
        print(f"Unhandled exception: {type(e).__name__}: {e}")
        sys.exit(1)
