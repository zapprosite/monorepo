"""
Nexus Classifier — Task complexity classifier

Uses Kimi K2.6 (or primary LLM) to classify task complexity in ONE call.
Output determines routing: Ollama (local/fast) vs Kimi (cloud/smart).
"""
import os
import json
import logging
from typing import Optional

from .models import Task, Classification, TaskType

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """You are Nexus Classifier, a task complexity analyzer.

Analyze the task and classify it into ONE of three levels:

**MECHANICAL** — Simple, well-defined, low ambiguity
Examples: "Write unit tests for this function", "Refactor to use async/await", 
"Add type hints", "Fix import errors", "Generate SQL migration"
→ Route to: ollama (local, fast, cheap)

**ANALYTICAL** — Requires analysis, pattern recognition, or review
Examples: "Code review this PR", "Find bugs in this diff", "Optimize query performance",
"Refactor component architecture", "Implement feature following existing patterns"
→ Route to: ollama (primary) + kimi validation (quality gate)

**STRATEGIC** — Complex decisions, novel problems, architecture design
Examples: "Design auth system from scratch", "Choose between PostgreSQL and Qdrant",
"Refactor entire monorepo structure", "Design API for new microservice",
"Make breaking change decisions"
→ Route to: kimi (cloud, reasoning-heavy)

Respond ONLY with valid JSON:
{
  "level": "mechanical|analytical|strategic",
  "confidence": 0.0-1.0,
  "estimated_tokens": integer,
  "recommended_model": "ollama-qwen2.5-coder|kimi-k2.6",
  "reason": "brief explanation",
  "can_parallelize": true|false,
  "subtasks": ["if strategic, decompose into smaller tasks"]
}

Task: {description}
Files: {files}
Context: {context}
"""

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
PRIMARY_MODEL = os.environ.get("NEXUS_CLASSIFIER_MODEL", "hermes-auto")


def classify_task(task: Task, override_model: Optional[str] = None) -> Classification:
    """
    Classify task complexity using primary LLM.
    Falls back to heuristic if LLM unavailable.
    """
    # Try LLM classification first
    try:
        return _classify_with_llm(task, override_model)
    except Exception as exc:
        logger.warning("LLM classification failed (%s), using heuristic", exc)
        return _classify_heuristic(task)


def _classify_with_llm(task: Task, model: Optional[str] = None) -> Classification:
    """Call Ollama or LiteLLM for classification."""
    import requests

    prompt = CLASSIFICATION_PROMPT.format(
        description=task.description,
        files=", ".join(task.files) or "none",
        context=json.dumps(task.context, ensure_ascii=False)[:500],
    )

    model_alias = model or PRIMARY_MODEL
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": model_alias,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        },
        timeout=30,
    )
    resp.raise_for_status()

    data = resp.json()
    raw = data.get("response", "")

    # Parse JSON from response
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try extracting JSON from markdown
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            raise ValueError(f"Invalid JSON response: {raw[:200]}")

    return Classification(**result)


def _classify_heuristic(task: Task) -> Classification:
    """Fast heuristic classification when LLM is unavailable."""
    desc_lower = task.description.lower()
    files = task.files

    # Strategic keywords
    strategic_keywords = ["design", "architecture", "choose", "decide", "strategy",
                          "refactor entire", "migrate", "restructure", "breaking change"]
    # Mechanical keywords
    mechanical_keywords = ["write test", "add type", "fix import", "format", "lint",
                           "generate sql", "add docstring", "rename"]

    score = 0
    for kw in strategic_keywords:
        if kw in desc_lower:
            score += 2
    for kw in mechanical_keywords:
        if kw in desc_lower:
            score -= 1

    # File count heuristic
    if len(files) > 10:
        score += 2
    elif len(files) == 0:
        score += 1

    if score >= 2:
        level = TaskType.STRATEGIC
        model = "kimi-k2.6"
    elif score >= 0:
        level = TaskType.ANALYTICAL
        model = "ollama-qwen2.5-coder"
    else:
        level = TaskType.MECHANICAL
        model = "ollama-qwen2.5-coder"

    return Classification(
        level=level,
        confidence=0.6,
        estimated_tokens=len(desc_lower) * 3 + len(files) * 500,
        recommended_model=model,
        reason=f"Heuristic score={score} (strategic keywords found)",
        can_parallelize=len(files) > 3 and level != TaskType.STRATEGIC,
        subtasks=[],
    )
