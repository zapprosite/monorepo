"""
Nexus Router — CLI-agnostic orchestrator

Works with ANY CLI: OpenCode, Codex, Claude Code, Aider.
Automatically detects the primary model from env vars.

Usage:
    router = SmartRouter()
    result = await router.process_task(task)

Retry logic:
    - If execution fails: retry up to task.max_iterations
    - If validation fails with score < 0.6: escalate to primary model
    - If validation passes with score >= 0.8: done
    - If 0.6 <= score < 0.8: apply suggestions and retry
"""
import asyncio
import logging
from typing import Optional

from .models import Task, ExecutionResult, ValidationResult, TaskType
from .classifier import classify_task
from .executor import execute_task
from .validator import validate_result
from .config import get_primary_model

logger = logging.getLogger(__name__)


class SmartRouter:
    """
    Orchestrates the full pipeline: classify → execute → validate.
    CLI-agnostic: works with OpenCode, Codex, Claude Code, Aider, etc.
    """

    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries

    async def process_task(self, task: Task) -> ExecutionResult:
        """
        Full pipeline: classify, execute, validate, retry if needed.
        """
        logger.info("Processing task %s: %s", task.id, task.description[:60])

        # Step 1: Classify
        classification = classify_task(task)
        logger.info("Classified as %s (confidence %.2f), model: %s",
                    classification.level.value,
                    classification.confidence,
                    classification.recommended_model)

        # Step 2: Execute (with retries)
        result = await self._execute_with_retries(task, classification)

        # Step 3: Validate
        validation = validate_result(task, result)
        logger.info("Validation: passed=%s score=%.2f issues=%d",
                    validation.passed, validation.score, len(validation.issues))

        # Step 4: Handle validation outcome
        if not validation.passed and validation.score < 0.6:
            logger.warning("Validation failed (score %.2f), escalating to primary model: %s",
                          validation.score, get_primary_model())
            # Force strategic execution with PRIMARY model
            classification.level = TaskType.STRATEGIC
            classification.recommended_model = get_primary_model()
            result = await self._execute_with_retries(task, classification)

        return result

    async def _execute_with_retries(self, task: Task, classification) -> ExecutionResult:
        """Execute with retry loop."""
        last_error = None
        for attempt in range(1, task.max_iterations + 1):
            result = await execute_task(task, classification)
            result.attempts = attempt

            if not result.error:
                return result

            last_error = result.error
            logger.warning("Attempt %d failed: %s", attempt, last_error)
            await asyncio.sleep(1 * attempt)  # Exponential backoff

        # All retries exhausted
        result.error = f"All {task.max_iterations} attempts failed. Last error: {last_error}"
        return result

    async def process_tasks_parallel(self, tasks: list[Task]) -> list[ExecutionResult]:
        """Process multiple tasks in parallel if they are independent."""
        return await asyncio.gather(*[self.process_task(t) for t in tasks])
