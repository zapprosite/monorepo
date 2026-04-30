#!/usr/bin/env python3
"""
queue-manager.py — Atomic queue operations com fcntl.flock
Todas as operações são atômicas e consistentes dentro do lock.
"""
import sys
import json
import os
import fcntl
import tempfile
import shutil
from pathlib import Path

QUEUE_FILE = Path(os.environ.get("QUEUE_FILE", "/srv/monorepo/.claude/vibe-kit/queue.json"))
LOCK_FILE = Path(str(QUEUE_FILE) + ".lock")


def _read_queue():
    """Lê queue.json dentro do lock."""
    with open(QUEUE_FILE) as f:
        return json.load(f)


def _write_queue(queue):
    """Escreve queue.json via temp file + atomic replace."""
    fd, tmp_path = tempfile.mkstemp(dir=QUEUE_FILE.parent, prefix=".queue_tmp_")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(queue, f, indent=2)
        os.replace(tmp_path, QUEUE_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def _recalc_counts(queue):
    """Recalcula pending/running/done/failed/frozen dentro do lock."""
    tasks = queue.get("tasks", [])
    queue["pending"] = sum(1 for t in tasks if t.get("status") == "pending")
    queue["running"] = sum(1 for t in tasks if t.get("status") == "running")
    queue["done"] = sum(1 for t in tasks if t.get("status") == "done")
    queue["failed"] = sum(1 for t in tasks if t.get("status") == "failed")
    queue["frozen"] = sum(1 for t in tasks if t.get("status") == "frozen")
    return queue


def claim(worker_id: str) -> dict | None:
    """Claim the first pending task atomically. Returns task JSON or None."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)

        queue = _read_queue()
        for i, task in enumerate(queue.get("tasks", [])):
            if task.get("status") == "pending":
                task["status"] = "running"
                task["worker"] = worker_id
                queue = _recalc_counts(queue)
                _write_queue(queue)

                result = dict(task)
                result.pop("_idx", None)
                return result

        return None
    finally:
        os.close(lock_fd)


def complete(task_id: str, worker_id: str, result: str) -> bool:
    """Mark a task as done/failed atomically. Returns True if found."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)

        queue = _read_queue()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id and task.get("worker") == worker_id:
                task["status"] = result
                task["completed_at"] = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
                updated = True
                break

        if updated:
            queue = _recalc_counts(queue)
            _write_queue(queue)
        return updated
    finally:
        os.close(lock_fd)


def retry(task_id: str, worker_id: str) -> bool:
    """Reset a failed task back to pending, clear worker assignment."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        queue = _read_queue()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id and task.get("status") == "failed":
                task["status"] = "pending"
                task["worker"] = None
                task["attempts"] = task.get("attempts", 0) + 1
                task["completed_at"] = None
                task["error"] = None
                updated = True
                break
        if updated:
            queue = _recalc_counts(queue)
            _write_queue(queue)
        return updated
    finally:
        os.close(lock_fd)


def freeze(task_id: str) -> bool:
    """Mark a task as frozen to prevent re-claim."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        queue = _read_queue()
        updated = False
        for task in queue.get("tasks", []):
            if task.get("id") == task_id:
                task["status"] = "frozen"
                task["worker"] = None
                updated = True
                break
        if updated:
            queue = _recalc_counts(queue)
            _write_queue(queue)
        return updated
    finally:
        os.close(lock_fd)


def set_limit(limit: int) -> bool:
    """Set the parallel_limit in the queue header."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        queue = _read_queue()
        queue["parallel_limit"] = limit
        _write_queue(queue)
        return True
    finally:
        os.close(lock_fd)


def reset_context(task_id: str) -> int:
    """Create context directory for task with prompt.md, log.md, commit.md and .active_task."""
    import time
    ctx_dir = Path("/srv/monorepo/.claude/vibe-kit/context") / task_id
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        ctx_dir.mkdir(parents=True, exist_ok=True)
        (ctx_dir / "prompt.md").write_text("")
        (ctx_dir / "log.md").write_text("")
        (ctx_dir / "commit.md").write_text("")
        (ctx_dir / ".active_task").write_text(task_id)
        return 0
    finally:
        os.close(lock_fd)


def commit(task_id: str, message: str) -> int:
    """Write message with timestamp to commit.md and append entry to log.md."""
    import time
    ctx_dir = Path("/srv/monorepo/.claude/vibe-kit/context") / task_id
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        commit_file = ctx_dir / "commit.md"
        commit_file.write_text(f"[{timestamp}] {message}\n")
        log_file = ctx_dir / "log.md"
        log_file.write_text(log_file.read_text() + f"[{timestamp}] commit: {message}\n")
        return 0
    finally:
        os.close(lock_fd)


def stats() -> dict:
    """Retorna estatísticas da fila. Lec sempre."""
    lock_fd = os.open(str(LOCK_FILE), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_SH)
        queue = _read_queue()
        return {
            "total": queue.get("total", 0),
            "pending": queue.get("pending", 0),
            "running": queue.get("running", 0),
            "done": queue.get("done", 0),
            "failed": queue.get("failed", 0),
            "frozen": sum(1 for t in queue.get("tasks", []) if t.get("status") == "frozen"),
            "parallel_limit": queue.get("parallel_limit", 5),
        }
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: queue-manager.py <command> [args]")
        print("Commands: claim <worker_id> | complete <task_id> <worker_id> <result> | stats")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "claim":
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