#!/usr/bin/env python3
# state-manager.py — Cross-CLI atomic state management
# Uses fcntl.flock + os.replace for safe concurrent access
# State file: .claude/state.json
import sys
import json
import os
import fcntl
import time
import argparse
from pathlib import Path

# STATE_DIR is the .claude directory (parent of events/)
_STATE_ENV = os.environ.get("EVENT_DIR", "")
if _STATE_ENV:
    _CLAUDE_DIR = Path(_STATE_ENV).parent.resolve()
else:
    _CLAUDE_DIR = Path.home() / ".claude"
STATE_DIR = _CLAUDE_DIR
STATE_FILE = STATE_DIR / "state.json"
LOCK_FILE = STATE_DIR / ".state.lock"

def read_state():
    """Read state with shared flock (readers can run concurrently)."""
    try:
        with open(STATE_FILE, "r") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                return json.load(f)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"version": 1, "agents": {}, "events": {}, "queue": {}}

def write_state(state):
    """Write state atomically: unique temp file + rename, with exclusive flock."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    import uuid
    tmp_path = STATE_DIR / f".state.{uuid.uuid4().hex}.tmp"
    try:
        with open(tmp_path, "w") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                json.dump(state, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        os.replace(tmp_path, STATE_FILE)
    finally:
        tmp_path.unlink(missing_ok=True)

def _atomic_append(event_type, data):
    """Append event with exclusive lock for entire read-modify-write cycle."""
    import uuid
    LOCK = STATE_DIR / ".events.lock"

    with open(LOCK, "a") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            # Read current state
            state = {"version": 1, "agents": {}, "events": {}, "queue": {}}
            try:
                with open(STATE_FILE, "r") as f:
                    state = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            # Append event
            state.setdefault("events", {}).setdefault(event_type, [])
            state["events"][event_type].append({
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "data": data or {},
                "seq": uuid.uuid4().hex[:8]
            })
            # Keep last 1000 per type
            state["events"][event_type] = state["events"][event_type][-1000:]

            # Write atomically
            tmp_path = STATE_DIR / f".state.{uuid.uuid4().hex}.tmp"
            with open(tmp_path, "w") as f:
                json.dump(state, f, indent=2)
            os.replace(tmp_path, STATE_FILE)
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

def get(key, subkey=None):
    state = read_state()
    if subkey:
        return state.get(key, {}).get(subkey)
    return state.get(key)

def set(key, value, subkey=None):
    state = read_state()
    if subkey:
        if key not in state:
            state[key] = {}
        state[key][subkey] = value
    else:
        state[key] = value
    write_state(state)

def append_event(event_type, data=None):
    _atomic_append(event_type, data)

def agent_start(agent_id, tool=None, cwd=None):
    LOCK = STATE_DIR / ".events.lock"
    with open(LOCK, "a") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            state = read_state()
            state.setdefault("agents", {})[agent_id] = {
                "status": "running",
                "tool": tool,
                "cwd": cwd,
                "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "last_seen": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            write_state(state)
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

def agent_complete(agent_id, result=None):
    LOCK = STATE_DIR / ".events.lock"
    with open(LOCK, "a") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            state = read_state()
            if agent_id in state.get("agents", {}):
                state["agents"][agent_id]["status"] = "done"
                state["agents"][agent_id]["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                state["agents"][agent_id]["result"] = result
            write_state(state)
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

def queue_status(pending=0, running=0, done=0, failed=0):
    LOCK = STATE_DIR / ".events.lock"
    with open(LOCK, "a") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            state = read_state()
            state["queue"] = {
                "pending": pending,
                "running": running,
                "done": done,
                "failed": failed,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            write_state(state)
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cross-CLI state manager")
    sub = parser.add_subparsers(dest="cmd")

    r = sub.add_parser("get", help="get <key> [subkey]")
    r.add_argument("key")
    r.add_argument("subkey", nargs="?")

    s = sub.add_parser("set", help="set <key> <value> [subkey]")
    s.add_argument("key")
    s.add_argument("value")
    s.add_argument("subkey", nargs="?")

    e = sub.add_parser("event", help="event <type> [key=value ...]")
    e.add_argument("type")
    e.add_argument("kv", nargs="*")

    a = sub.add_parser("agent-start", help="agent-start <agent_id>")
    a.add_argument("agent_id")
    a.add_argument("--tool")
    a.add_argument("--cwd")

    c = sub.add_parser("agent-complete", help="agent-complete <agent_id> [result]")
    c.add_argument("agent_id")
    c.add_argument("result", nargs="?")

    q = sub.add_parser("queue-status", help="queue-status pending running done failed")
    q.add_argument("pending", type=int)
    q.add_argument("running", type=int)
    q.add_argument("done", type=int)
    q.add_argument("failed", type=int)

    dump = sub.add_parser("dump", help="dump — print full state")

    args = parser.parse_args()

    if args.cmd == "get":
        result = get(args.key, args.subkey)
        print(json.dumps(result, indent=2))
    elif args.cmd == "set":
        set(args.key, args.value, args.subkey)
        print("OK")
    elif args.cmd == "event":
        data = dict(kv.split("=", 1) for kv in args.kv) if args.kv else None
        append_event(args.type, data)
        print("OK")
    elif args.cmd == "agent-start":
        agent_start(args.agent_id, args.tool, args.cwd)
        print("OK")
    elif args.cmd == "agent-complete":
        agent_complete(args.agent_id, args.result)
        print("OK")
    elif args.cmd == "queue-status":
        queue_status(args.pending, args.running, args.done, args.failed)
        print("OK")
    elif args.cmd == "dump":
        print(json.dumps(read_state(), indent=2))
    else:
        parser.print_help()
