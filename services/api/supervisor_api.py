#!/usr/bin/env python3
"""
Hermes Supervisor API — FastAPI server
Part of SPEC-POLYMER-006 Phase 2

Usage:
    python3 supervisor_api.py [--port 8092]
"""
import argparse
import sys
from pathlib import Path

# ─── Fix imports ───────────────────────────────────────────────────────────
# Add service directories to path
_services_dir = Path(__file__).parent.parent
_rate_limiter_dir = _services_dir / "rate-limiter"
_task_queue_dir = _services_dir / "task-queue"

# Insert in order: rate_limiter, task_queue, then services for package imports
sys.path.insert(0, str(_rate_limiter_dir))
sys.path.insert(0, str(_task_queue_dir))
sys.path.insert(0, str(_services_dir))

# ─── Imports ──────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException
import uvicorn

# Import our modules
from rate_limiter import get_rate_limiter, RateLimiter
from task_queue import TaskQueue, Task, Priority, get_task_queue

# ─── Configuration ────────────────────────────────────────────────────────

DEFAULT_PORT = 8092
AGENT_SCRIPTS = {
    "sre": "/srv/monorepo/services/subagents/subagent-sre.sh",
    "backup": "/srv/monorepo/services/subagents/subagent-backup.sh",
    "security": "/srv/monorepo/services/subagents/subagent-security.sh",
}

LOG_DIR = Path("/srv/ops/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)


# ─── Mode Detection ─────────────────────────────────────────────────────────

class Mode(str):
    DEV = "DEV"
    JUNIOR = "JUNIOR"
    SENIOR = "SÊNIOR"
    EMERGENCY = "EMERGENCY"


def detect_mode(message: str) -> Mode:
    msg_lower = message.lower()
    
    if any(kw in msg_lower for kw in ["emergency", "emergencia", "incidente", "down", "crash", "ataque", "/panic", "/alert"]):
        return Mode.EMERGENCY
    if any(kw in msg_lower for kw in ["/senior", "auditoria", "arquitetura", "spec", "specs", "refatorar"]):
        return Mode.SENIOR
    if any(kw in msg_lower for kw in ["/dev", "codar", "implementar", "bug", "teste", "feature", "fix"]):
        return Mode.DEV
    return Mode.JUNIOR


def route_to_agent(mode: Mode, message: str) -> str:
    msg_lower = message.lower()
    
    if mode == Mode.EMERGENCY:
        return "security"
    
    if mode == Mode.SENIOR:
        if any(kw in msg_lower for kw in ["audit", "seguranca", "firewall", "ufw", "senior"]):
            return "security"
        if any(kw in msg_lower for kw in ["doc", "wiki", "brain", "skill", "memory"]):
            return "docs"
        return "sre"
    
    if mode == Mode.JUNIOR:
        if any(kw in msg_lower for kw in ["docker", "container", "coolify", "servico", "health", "zfs", "disk", "gpu"]):
            return "sre"
        if any(kw in msg_lower for kw in ["doc", "wiki", "brain", "skill", "memory", "context"]):
            return "docs"
        if any(kw in msg_lower for kw in ["snapshot", "zfs", "disaster"]):
            return "backup"
        if any(kw in msg_lower for kw in ["security", "audit", "firewall"]):
            return "security"
        return "sre"
    
    if mode == Mode.DEV:
        return "dev"
    
    return "sre"


# ─── Sub-agent Executor ────────────────────────────────────────────────────

def execute_subagent(agent: str, task: str) -> dict:
    """Execute task on sub-agent script."""
    script = AGENT_SCRIPTS.get(agent)
    if not script:
        return {"success": False, "error": f"Unknown agent: {agent}"}
    
    import subprocess
    
    try:
        result = subprocess.run(
            [script, "check"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        
        return {
            "success": result.returncode == 0,
            "agent": agent,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout after 120s"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── FastAPI App ───────────────────────────────────────────────────────────

app = FastAPI(title="Hermes Supervisor API", version="1.0.0")

_rate_limiter = None
_task_queue = None


@app.on_event("startup")
async def startup():
    global _rate_limiter, _task_queue
    _rate_limiter = get_rate_limiter()
    # Use in-memory queue (Redis optional)
    try:
        _task_queue = TaskQueue(skip_redis=True)  # In-memory only
        print("Task queue: in-memory mode (Redis optional)")
    except Exception as e:
        print(f"Warning: Task queue unavailable: {e}")
        _task_queue = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-supervisor"}


@app.get("/status")
async def status():
    rate_stats = _rate_limiter.get_all_stats() if _rate_limiter else {}
    queue_size = _task_queue.queue_size() if _task_queue else -1
    
    return {
        "supervisor": "hermes",
        "version": "1.0.0",
        "rate_limiter": {
            "rpm_limit": _rate_limiter.rpm_limit if _rate_limiter else 0,
            "agents": rate_stats,
        },
        "task_queue": {
            "available": _task_queue is not None,
            "size": queue_size,
        },
        "agents": {
            "sre": {"script": AGENT_SCRIPTS["sre"], "status": "available"},
            "backup": {"script": AGENT_SCRIPTS["backup"], "status": "available"},
            "security": {"script": AGENT_SCRIPTS["security"], "status": "available"},
            "dev": {"script": None, "status": "cli_only"},
            "docs": {"script": None, "status": "cli_only"},
        },
    }


@app.post("/enqueue")
async def enqueue_task(
    task: str,
    mode: str = None,
    agent: str = None,
    priority: int = None,
):
    detected_mode = Mode(mode) if mode else detect_mode(task)
    target_agent = agent or route_to_agent(detected_mode, task)
    task_priority = priority if priority is not None else detected_mode.value
    
    if _task_queue:
        task_id = _task_queue.enqueue(
            description=task,
            priority=task_priority,
            agent=target_agent,
            mode=detected_mode,
        )
        return {"task_id": task_id, "agent": target_agent, "mode": detected_mode}
    
    raise HTTPException(status_code=503, detail="Task queue unavailable (Redis down?)")


@app.post("/execute")
async def execute_task(
    task: str,
    agent: str = None,
    mode: str = None,
):
    detected_mode = Mode(mode) if mode else detect_mode(task)
    target_agent = agent or route_to_agent(detected_mode, task)
    
    if _rate_limiter:
        if not _rate_limiter.acquire(target_agent, tokens=1, timeout=5.0):
            raise HTTPException(status_code=429, detail=f"Rate limited for {target_agent}")
    
    result = execute_subagent(target_agent, task)
    
    return {
        "task": task,
        "agent": target_agent,
        "mode": detected_mode,
        "result": result,
    }


@app.get("/rate-limit/stats")
async def rate_limit_stats(agent: str = None):
    if not _rate_limiter:
        raise HTTPException(status_code=503, detail="Rate limiter unavailable")
    
    if agent:
        return _rate_limiter.get_stats(agent)
    return _rate_limiter.get_all_stats()


@app.post("/rate-limit/reset")
async def rate_limit_reset(agent: str = None):
    if not _rate_limiter:
        raise HTTPException(status_code=503, detail="Rate limiter unavailable")
    
    _rate_limiter.reset(agent)
    return {"reset": agent or "all"}


# ─── CLI ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Hermes Supervisor API")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port (default: {DEFAULT_PORT})")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    args = parser.parse_args()
    
    print(f"Starting Hermes Supervisor API on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
