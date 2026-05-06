"""
Nexus API — FastAPI endpoints for Smart Router

Endpoints:
  POST /nexus/tasks       — Submit task for processing
  GET  /nexus/tasks/{id}  — Get task status/result
  POST /nexus/classify    — Classify task only (no execution)
  GET  /nexus/health      — Health check
"""
import os
import asyncio
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

import sys
from pathlib import Path
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from libs.nexus import SmartRouter, Task, Classification
from libs.nexus.models import ExecutionResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = SmartRouter()

# In-memory store for task results (replace with Redis for production)
_task_store: dict[str, ExecutionResult] = {}


class TaskRequest(BaseModel):
    description: str
    files: list[str] = []
    test_cmd: Optional[str] = None
    context: dict = {}
    priority: int = 1
    max_iterations: int = 3


class ClassificationResponse(BaseModel):
    level: str
    confidence: float
    estimated_tokens: int
    recommended_model: str
    reason: str
    can_parallelize: bool


@router_fastapi = None  # placeholder for FastAPI router

# Using direct app since this file may be imported or run standalone
app_nexus = FastAPI(title="Nexus Smart Router API", version="1.0.0")


@app_nexus.post("/nexus/tasks")
async def submit_task(req: TaskRequest, background_tasks: BackgroundTasks):
    """Submit a task for async processing."""
    task = Task(
        description=req.description,
        files=req.files,
        test_cmd=req.test_cmd,
        context=req.context,
        priority=req.priority,
        max_iterations=req.max_iterations,
    )

    # Start processing in background
    background_tasks.add_task(_process_task_async, task)

    return {
        "task_id": task.id,
        "status": "processing",
        "message": "Task submitted successfully",
    }


@app_nexus.get("/nexus/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task result by ID."""
    if task_id not in _task_store:
        raise HTTPException(status_code=404, detail="Task not found")

    result = _task_store[task_id]
    return {
        "task_id": result.task_id,
        "status": "completed" if not result.error else "failed",
        "model_used": result.model_used,
        "output": result.output,
        "error": result.error,
        "tokens_used": result.tokens_used,
        "duration_ms": result.duration_ms,
        "attempts": result.attempts,
    }


@app_nexus.post("/nexus/classify")
async def classify_only(req: TaskRequest):
    """Classify task without executing."""
    task = Task(
        description=req.description,
        files=req.files,
        context=req.context,
    )
    classification = router.classify_task(task)
    return ClassificationResponse(
        level=classification.level.value,
        confidence=classification.confidence,
        estimated_tokens=classification.estimated_tokens,
        recommended_model=classification.recommended_model,
        reason=classification.reason,
        can_parallelize=classification.can_parallelize,
    )


@app_nexus.get("/nexus/health")
async def nexus_health():
    """Health check with model availability."""
    import aiohttp
    litellm_ok = False
    llama_server_ok = False

    async with aiohttp.ClientSession() as session:
        try:
            async with session.get("http://localhost:8001/health", timeout=5) as resp:
                llama_server_ok = resp.status == 200
        except Exception:
            pass

        try:
            async with session.get("http://localhost:4018/health", timeout=5) as resp:
                litellm_ok = resp.status == 200
        except Exception:
            pass

    return {
        "status": "ok",
        "service": "nexus",
        "llama_server_available": llama_server_ok,
        "litellm_available": litellm_ok,
    }


async def _process_task_async(task: Task):
    """Background task processor."""
    try:
        result = await router.process_task(task)
        _task_store[task.id] = result
        logger.info("Task %s completed (model: %s, duration: %dms)",
                    task.id, result.model_used, result.duration_ms)
    except Exception as exc:
        logger.error("Task %s failed: %s", task.id, exc)
        _task_store[task.id] = ExecutionResult(
            task_id=task.id,
            model_used="error",
            output="",
            error=str(exc),
        )
