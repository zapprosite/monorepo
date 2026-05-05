"""
Nexus Classifier — CLI-agnostic task complexity classifier

Uses the PRIMARY model (whatever CLI invoked us) for classification.
Falls back to heuristic if LLM unavailable.
"""
import os
import json
import logging
from typing import Optional

from .models import Task, Classification, TaskType
from .config import get_primary_model, OLLAMA_URL

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """You are Nexus Classifier, a task complexity analyzer.

Analyze the task and classify it into ONE of three levels:

**MECHANICAL** — Simple, well-defined, low ambiguity. The local model can handle this.
Examples: "Write unit tests", "Refactor to use async/await", "Add type hints", 
"Fix import errors", "Generate SQL migration", "Format code"
→ Route to: LOCAL model (fast, cheap, private)

**ANALYTICAL** — Requires analysis, pattern recognition, or review. Local model does the work,
but should be validated by the primary model.
Examples: "Code review this PR", "Find bugs in this diff", "Optimize query performance",
"Refactor component following existing patterns"
→ Route to: LOCAL model (primary) + PRIMARY model validation (quality gate)

**STRATEGIC** — Complex decisions, novel problems, architecture design. Requires the primary model.
Examples: "Design auth system from scratch", "Choose between PostgreSQL and Qdrant",
"Refactor entire monorepo structure", "Design API for new microservice"
→ Route to: PRIMARY model (reasoning-heavy)

Respond ONLY with valid JSON:
{
  "level": "mechanical|analytical|strategic",
  "confidence": 0.0-1.0,
  "estimated_tokens": integer,
  "recommended_model": "local|primary",
  "reason": "brief explanation",
  "can_parallelize": true|false,
  "subtasks": ["if strategic, decompose into smaller tasks"]
}

Task: {description}
Files: {files}
Context: {context}
"""


def classify_task(task: Task, override_model: Optional[str] = None) -> Classification:
    """
    Classify task complexity using the PRIMARY model (CLI-agnostic).
    Falls back to heuristic if LLM unavailable.
    """
    try:
        return _classify_with_llm(task, override_model)
    except Exception as exc:
        logger.warning("LLM classification failed (%s), using heuristic", exc)
        return _classify_heuristic(task)


def _classify_with_llm(task: Task, model: Optional[str] = None) -> Classification:
    """Call Ollama or LiteLLM for classification using PRIMARY model."""
    import requests

    prompt = CLASSIFICATION_PROMPT.format(
        description=task.description,
        files=", ".join(task.files) or "none",
        context=json.dumps(task.context, ensure_ascii=False)[:500],
    )

    model_alias = model or get_primary_model()
    
    # Try LiteLLM first (primary model may be cloud)
    litellm_url = os.environ.get("LITELLM_URL", "http://localhost:4018")
    try:
        resp = requests.post(
            f"{litellm_url}/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            json={
                "model": model_alias,
                "messages": [
                    {"role": "system", "content": "You are a task complexity classifier."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 512,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data["choices"][0]["message"]["content"]
    except Exception:
        # Fallback to Ollama
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model_alias,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data.get("response", "")

    # Parse JSON
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            raise ValueError(f"Invalid JSON response: {raw[:200]}")

    # Normalize model field
    if result.get("recommended_model") == "local":
        result["recommended_model"] = os.environ.get("NEXUS_OLLAMA_CODE", "hermes-local-code")
    elif result.get("recommended_model") == "primary":
        result["recommended_model"] = get_primary_model()

    return Classification(**result)


def _classify_heuristic(task: Task) -> Classification:
    """Fast heuristic classification when LLM is unavailable."""
    desc_lower = task.description.lower()
    files = task.files

    strategic_keywords = ["design", "architecture", "choose", "decide", "strategy",
                          "refactor entire", "migrate", "restructure", "breaking change"]
    mechanical_keywords = ["write test", "write tests", "add type", "fix import", "format", "lint",
                           "generate sql", "add docstring", "rename"]

    score = 0
    for kw in strategic_keywords:
        if kw in desc_lower:
            score += 2
    for kw in mechanical_keywords:
        if kw in desc_lower:
            score -= 1

    if len(files) > 10:
        score += 2
    elif len(files) == 0:
        score += 1

    if score >= 2:
        level = TaskType.STRATEGIC
        model = "primary"  # Will be resolved to actual model
    elif score >= 0:
        level = TaskType.ANALYTICAL
        model = "local"
    else:
        level = TaskType.MECHANICAL
        model = "local"

    return Classification(
        level=level,
        confidence=0.6,
        estimated_tokens=len(desc_lower) * 3 + len(files) * 500,
        recommended_model=get_primary_model() if model == "primary" else os.environ.get("NEXUS_OLLAMA_CODE", "hermes-local-code"),
        reason=f"Heuristic score={score}",
        can_parallelize=len(files) > 3 and level != TaskType.STRATEGIC,
        subtasks=[],
    )
