"""
Nexus Executor — Async task execution engine

Routes tasks to appropriate model and executes them.
Supports both Ollama (local) and cloud LLMs via LiteLLM.
"""
import os
import time
import json
import asyncio
import logging
from typing import Optional

import aiohttp

from .models import Task, Classification, ExecutionResult, TaskType

logger = logging.getLogger(__name__)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4018")

# Model aliases resolved via LiteLLM
MODEL_MAP = {
    "ollama-qwen2.5-coder": "hermes-local-code",
    "ollama-qwen2.5": "hermes-auto",
    "ollama-nomic-embed": "hermes-embed",
    "kimi-k2.6": "hermes-cloud-chat",
}

SYSTEM_PROMPTS = {
    TaskType.MECHANICAL: """You are a precise code implementation agent.
Implement exactly what is requested. No extra comments unless asked.
Follow existing code style. Return only the modified code.""",
    TaskType.ANALYTICAL: """You are a senior code reviewer and analyst.
Analyze thoroughly, consider edge cases, and provide actionable feedback.
Be concise but complete.""",
    TaskType.STRATEGIC: """You are a principal architect.
Think deeply about trade-offs, long-term maintainability, and system design.
Consider the broader context of the codebase.""",
}


async def execute_task(task: Task, classification: Classification) -> ExecutionResult:
    """
    Execute task using the model determined by classification.
    Returns ExecutionResult with output, files modified, and test status.
    """
    start = time.time()
    model_alias = MODEL_MAP.get(classification.recommended_model, classification.recommended_model)

    try:
        if classification.level in (TaskType.MECHANICAL, TaskType.ANALYTICAL):
            output = await _execute_ollama(task, classification, model_alias)
        else:
            output = await _execute_litellm(task, classification, model_alias)

        duration = int((time.time() - start) * 1000)

        return ExecutionResult(
            task_id=task.id,
            model_used=model_alias,
            output=output,
            tokens_used=_estimate_tokens(task.description + output),
            duration_ms=duration,
        )

    except Exception as exc:
        logger.error("Execution failed for task %s: %s", task.id, exc)
        return ExecutionResult(
            task_id=task.id,
            model_used=model_alias,
            output="",
            error=str(exc),
            duration_ms=int((time.time() - start) * 1000),
        )


async def _execute_ollama(task: Task, classification: Classification, model: str) -> str:
    """Execute via Ollama (local)."""
    system_prompt = SYSTEM_PROMPTS[classification.level]
    user_prompt = _build_user_prompt(task)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "system": system_prompt,
                "prompt": user_prompt,
                "stream": False,
                "options": {"temperature": 0.2 if classification.level == TaskType.MECHANICAL else 0.5},
            },
            timeout=aiohttp.ClientTimeout(total=120),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data.get("response", "")


async def _execute_litellm(task: Task, classification: Classification, model: str) -> str:
    """Execute via LiteLLM (cloud proxy)."""
    system_prompt = SYSTEM_PROMPTS[classification.level]
    user_prompt = _build_user_prompt(task)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{LITELLM_URL}/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3 if classification.level == TaskType.STRATEGIC else 0.5,
                "max_tokens": 4096,
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["choices"][0]["message"]["content"]


def _build_user_prompt(task: Task) -> str:
    """Build structured prompt from task."""
    parts = [f"Task: {task.description}"]
    if task.files:
        parts.append(f"Files to modify: {', '.join(task.files)}")
    if task.test_cmd:
        parts.append(f"Test command: {task.test_cmd}")
    if task.context:
        parts.append(f"Context: {json.dumps(task.context, ensure_ascii=False)}")
    return "\n\n".join(parts)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (4 chars per token)."""
    return len(text) // 4
