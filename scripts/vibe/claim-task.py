#!/usr/bin/env python3
"""
claim-task.py — Atomic task claimer
Usage: QUEUE_FILE=/path/queue.json python3 claim-task.py <worker_id>
"""
import sys, json, os
from pathlib import Path

queue_file = Path(os.environ.get("QUEUE_FILE", "/srv/monorepo/.claude/vibe-kit/queue.json"))
lock_file = Path(str(queue_file) + ".lock")
worker_id = sys.argv[1] if len(sys.argv) > 1 else "W00"

lock_fd = os.open(str(lock_file), os.O_RDWR | os.O_CREAT, 0o644)
try:
    os.lockf(lock_fd, os.F_LOCK, 0)
    
    with open(queue_file) as f:
        queue = json.load(f)
    
    # Find first pending task
    pending_task = None
    for i, task in enumerate(queue.get("tasks", [])):
        if task.get("status") == "pending":
            pending_task = task
            pending_task["_idx"] = i
            break
    
    if pending_task is None:
        print(json.dumps({"error": "no_pending_tasks"}))
        sys.exit(0)
    
    task_id = pending_task["id"]
    idx = pending_task["_idx"]
    
    # Claim it
    queue["tasks"][idx]["status"] = "running"
    queue["tasks"][idx]["worker"] = worker_id
    queue["running"] = sum(1 for t in queue["tasks"] if t.get("status") == "running")
    queue["pending"] = sum(1 for t in queue["tasks"] if t.get("status") == "pending")
    
    with open(queue_file, "w") as f:
        json.dump(queue, f)
    
    # Return task JSON
    del pending_task["_idx"]
    print(json.dumps(pending_task))
    
finally:
    os.close(lock_fd)
