#!/usr/bin/env python3
"""vibe-self-healer.py — Self-healing watchdog for brain-refactor workers"""

import json
import os
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

WORKDIR = "/srv/monorepo/.claude/brain-refactor"
QUEUE = WORKDIR + "/queue.json"
DLQ = WORKDIR + "/dlq.json"
LOG = WORKDIR + "/logs/self-healer.log"
LOCK = WORKDIR + "/.self-healer.lock"

STUCK_THRESHOLD_HOURS = 2
MAX_RETRIES = 3
BACKOFF_BASE = 60

def log(msg: str):
    ts = datetime.utcnow().isoformat() + "Z"
    with open(LOG, "a") as f:
        f.write("[" + ts + "] " + msg + "\n")

def acquire_lock() -> bool:
    if os.path.exists(LOCK):
        try:
            with open(LOCK) as f:
                pid = int(f.read().strip())
            if pid and os.path.exists("/proc/" + str(pid)):
                log("Already running PID=" + str(pid) + ", exiting")
                return False
        except:
            pass
        log("Stale lock cleared")
    with open(LOCK, "w") as f:
        f.write(str(os.getpid()))
    return True

def release_lock():
    if os.path.exists(LOCK):
        os.remove(LOCK)

def init_dlq():
    if not os.path.exists(DLQ):
        dlq = {"dlq": [], "stats": {"total_failed": 0, "retried": 0, "dead_lettered": 0}}
        with open(DLQ, "w") as f:
            json.dump(dlq, f, indent=2)

def load_queue() -> Dict:
    with open(QUEUE) as f:
        return json.load(f)

def save_queue(q: Dict):
    with open(QUEUE, "w") as f:
        json.dump(q, f, indent=2)

def load_dlq() -> Dict:
    if os.path.exists(DLQ):
        with open(DLQ) as f:
            return json.load(f)
    return {"dlq": [], "stats": {"total_failed": 0, "retried": 0, "dead_lettered": 0}}

def save_dlq(d: Dict):
    with open(DLQ, "w") as f:
        json.dump(d, f, indent=2)

def get_backoff_seconds(retry_count: int) -> int:
    return BACKOFF_BASE * (2 ** retry_count)

def detect_stuck_and_failed(q: Dict) -> Tuple:
    now = datetime.utcnow()
    stuck = []
    retryable = []
    for t in q["tasks"]:
        status = t.get("status", "pending")
        if status == "running" and t.get("started_at"):
            try:
                started = datetime.fromisoformat(t["started_at"].replace("Z", "+00:00"))
                age_hours = (now - started.replace(tzinfo=None)).total_seconds() / 3600
                if age_hours > STUCK_THRESHOLD_HOURS:
                    stuck.append({"id": t["id"], "name": t.get("name", "unknown"), "age_hours": round(age_hours, 1)})
            except Exception as e:
                log("Error parsing started_at for " + t.get("id", "?") + ": " + str(e))
        if status == "failed":
            retry_count = t.get("retry_count", 0)
            if retry_count < MAX_RETRIES:
                next_retry = t.get("next_retry_at")
                if next_retry:
                    try:
                        next_dt = datetime.fromisoformat(next_retry.replace("Z", "+00:00"))
                        if now >= next_dt.replace(tzinfo=None):
                            retryable.append({"id": t["id"], "name": t.get("name", "unknown"), "retry_count": retry_count, "reason": t.get("last_error", "unknown")})
                    except:
                        retryable.append({"id": t["id"], "name": t.get("name", "unknown"), "retry_count": retry_count, "reason": t.get("last_error", "unknown")})
                else:
                    retryable.append({"id": t["id"], "name": t.get("name", "unknown"), "retry_count": retry_count, "reason": t.get("last_error", "unknown")})
    return stuck, retryable

def mark_stuck(q: Dict, task_id: str, age_hours: float) -> Dict:
    for t in q["tasks"]:
        if t["id"] == task_id:
            t["status"] = "failed"
            t["last_error"] = "STUCK: worker ran for " + str(age_hours) + "h"
            t["retry_count"] = t.get("retry_count", 0)
            t["stuck_at"] = datetime.utcnow().isoformat() + "Z"
            break
    return q

def schedule_retry(q: Dict, dlq: Dict, task_id: str, retry_count: int, reason: str) -> Tuple:
    for t in q["tasks"]:
        if t["id"] == task_id:
            if retry_count >= MAX_RETRIES:
                t["status"] = "dead_lettered"
                t["dead_lettered_at"] = datetime.utcnow().isoformat() + "Z"
                t["final_error"] = reason
                dlq["dlq"].append({"task_id": task_id, "name": t.get("name", "unknown"), "description": t.get("description", ""), "retry_count": retry_count, "final_error": reason, "dead_lettered_at": datetime.utcnow().isoformat() + "Z"})
                dlq["stats"]["total_failed"] += 1
                dlq["stats"]["dead_lettered"] += 1
                log("Task " + task_id + " moved to DLQ after " + str(retry_count) + " retries")
            else:
                backoff = get_backoff_seconds(retry_count)
                next_retry = datetime.utcnow() + timedelta(seconds=backoff)
                t["status"] = "pending"
                t["retry_count"] = retry_count + 1
                t["last_error"] = reason
                t["next_retry_at"] = next_retry.isoformat() + "Z"
                dlq["stats"]["retried"] = dlq["stats"].get("retried", 0) + 1
                log("Task " + task_id + " retry " + str(retry_count+1) + "/" + str(MAX_RETRIES) + " in " + str(backoff) + "s")
            break
    return q, dlq

def relaunch_task(task_id: str, worker_id: str):
    q = load_queue()
    task_info = None
    for t in q["tasks"]:
        if t["id"] == task_id:
            task_info = t
            break
    if not task_info:
        log("Task " + task_id + " not found")
        return
    for t in q["tasks"]:
        if t["id"] == task_id:
            t["status"] = "running"
            t["worker"] = worker_id
            t["started_at"] = datetime.utcnow().isoformat() + "Z"
            t["stuck_count"] = t.get("stuck_count", 0) + 1
            break
    save_queue(q)
    log_file = WORKDIR + "/logs/" + worker_id + "-" + task_id + ".log"
    cmd = ["bash", WORKDIR + "/launch.sh", worker_id, task_id, task_info.get("name", ""), task_info.get("description", "")]
    with open(log_file, "w") as f:
        f.write("[" + datetime.utcnow().isoformat() + "Z] [" + worker_id + "] RESTART " + task_id + "\n")
    subprocess.Popen(cmd, stdout=open(log_file, "a"), stderr=subprocess.STDOUT, cwd=WORKDIR)
    log("Relaunched " + task_id + " as " + worker_id)

def run():
    if not acquire_lock():
        return
    try:
        init_dlq()
        log("Self-healer: starting")
        q = load_queue()
        dlq = load_dlq()
        stuck, retryable = detect_stuck_and_failed(q)
        log("Found " + str(len(stuck)) + " stuck, " + str(len(retryable)) + " retryable")
        for s in stuck:
            log("Stuck: " + s["id"] + " (" + s["name"] + ") at " + str(s["age_hours"]) + "h")
            q = mark_stuck(q, s["id"], s["age_hours"])
        for r in retryable:
            log("Retry: " + r["id"] + " (" + r["name"] + ") attempt " + str(r["retry_count"]+1) + "/" + str(MAX_RETRIES))
            q, dlq = schedule_retry(q, dlq, r["id"], r["retry_count"], r["reason"])
        save_queue(q)
        save_dlq(dlq)
        for r in retryable:
            relaunch_task(r["id"], "RH-" + datetime.utcnow().strftime("%H%M%S") + "-" + r["id"])
        for s in stuck:
            q = load_queue()
            for t in q["tasks"]:
                if t["id"] == s["id"] and t.get("status") == "failed":
                    t["status"] = "pending"
                    t["retry_count"] = t.get("retry_count", 0) + 1
                    save_queue(q)
                    break
            relaunch_task(s["id"], "SH-" + datetime.utcnow().strftime("%H%M%S") + "-" + s["id"])
        dlq = load_dlq()
        log("DLQ: " + str(len(dlq["dlq"])) + " items | stats: " + str(dlq["stats"]))
        log("Self-healer: done")
    finally:
        release_lock()

if __name__ == "__main__":
    run()
