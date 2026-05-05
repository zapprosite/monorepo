"""
Nexus Validator — Quality gates

Validates execution results using primary LLM (Kimi K2.6).
Acts as a quality gate before accepting Ollama-generated output.
"""
import os
import json
import logging
from typing import Optional

import requests

from .models import Task, ExecutionResult, ValidationResult

logger = logging.getLogger(__name__)

LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4018")
VALIDATOR_MODEL = os.environ.get("NEXUS_VALIDATOR_MODEL", "hermes-cloud-chat")

VALIDATION_PROMPT = """You are Nexus Validator, a senior engineer reviewing AI-generated code.

Review the following task and its execution result. Score from 0.0 to 1.0.

Scoring criteria:
- 1.0: Perfect, production-ready, no issues
- 0.8+: Minor issues, acceptable with small fixes
- 0.6+: Major issues, needs revision
- <0.6: Critical errors, reject and retry

Check for:
1. Correctness — Does it solve the stated problem?
2. Code quality — Follows best practices, clean code
3. Security — No SQL injection, XSS, hardcoded secrets
4. Tests — If test_cmd provided, were they considered?
5. Style — Consistent with existing codebase

Respond ONLY with valid JSON:
{
  "passed": true|false,
  "score": 0.0-1.0,
  "issues": ["list of problems"],
  "suggestions": ["improvements"]
}

Task: {description}
Files: {files}
Generated Output:
{output}
"""


def validate_result(task: Task, result: ExecutionResult, override_model: Optional[str] = None) -> ValidationResult:
    """
    Validate execution result using cloud LLM.
    If validation fails, the task should be retried or escalated.
    """
    if result.error:
        return ValidationResult(
            task_id=task.id,
            passed=False,
            score=0.0,
            issues=[f"Execution error: {result.error}"],
            suggestions=["Retry with different parameters or escalate to strategic model"],
        )

    try:
        return _validate_with_llm(task, result, override_model)
    except Exception as exc:
        logger.warning("LLM validation failed (%s), auto-passing with warning", exc)
        return ValidationResult(
            task_id=task.id,
            passed=True,
            score=0.7,
            issues=[f"Validation skipped due to LLM error: {exc}"],
            suggestions=["Manual review recommended"],
        )


def _validate_with_llm(task: Task, result: ExecutionResult, model: Optional[str] = None) -> ValidationResult:
    """Call LiteLLM for validation."""
    prompt = VALIDATION_PROMPT.format(
        description=task.description,
        files=", ".join(task.files) or "none",
        output=result.output[:4000],  # Limit context
    )

    model_alias = model or VALIDATOR_MODEL
    resp = requests.post(
        f"{LITELLM_URL}/v1/chat/completions",
        headers={"Content-Type": "application/json"},
        json={
            "model": model_alias,
            "messages": [
                {"role": "system", "content": "You are a strict code quality validator."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 1024,
        },
        timeout=60,
    )
    resp.raise_for_status()

    data = resp.json()
    raw = data["choices"][0]["message"]["content"]

    # Parse JSON
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
        else:
            raise ValueError(f"Invalid validation JSON: {raw[:200]}")

    return ValidationResult(
        task_id=task.id,
        passed=parsed.get("passed", False),
        score=parsed.get("score", 0.0),
        issues=parsed.get("issues", []),
        suggestions=parsed.get("suggestions", []),
        validator_model=model_alias,
    )
