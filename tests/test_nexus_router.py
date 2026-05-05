"""
test_nexus_router.py — Tests for Nexus SmartRouter
"""
import pytest
from unittest.mock import patch, AsyncMock

from libs.nexus.router import SmartRouter
from libs.nexus.models import Task, ExecutionResult, ValidationResult


@pytest.fixture
def router():
    return SmartRouter()


@pytest.fixture
def sample_task():
    return Task(description="Write a hello world function", files=["test.py"])


@pytest.mark.asyncio
async def test_process_task_success(router, sample_task):
    with patch("libs.nexus.router.execute_task", new_callable=AsyncMock) as mock_exec, \
         patch("libs.nexus.router.validate_result") as mock_val:

        mock_exec.return_value = ExecutionResult(
            task_id=sample_task.id,
            model_used="ollama",
            output="def hello(): pass",
            duration_ms=100,
        )
        mock_val.return_value = ValidationResult(
            task_id=sample_task.id,
            passed=True,
            score=0.95,
        )

        result = await router.process_task(sample_task)
        assert result.output == "def hello(): pass"
        assert result.attempts == 1


@pytest.mark.asyncio
async def test_process_task_retry_then_success(router, sample_task):
    with patch("libs.nexus.router.execute_task", new_callable=AsyncMock) as mock_exec, \
         patch("libs.nexus.router.validate_result") as mock_val:

        mock_exec.side_effect = [
            ExecutionResult(task_id=sample_task.id, model_used="ollama", output="", error="fail"),
            ExecutionResult(task_id=sample_task.id, model_used="ollama", output="success", duration_ms=100),
        ]
        mock_val.return_value = ValidationResult(
            task_id=sample_task.id,
            passed=True,
            score=0.9,
        )

        result = await router.process_task(sample_task)
        assert result.output == "success"
        assert result.attempts == 2


@pytest.mark.asyncio
async def test_process_task_escalation(router, sample_task):
    with patch("libs.nexus.router.execute_task", new_callable=AsyncMock) as mock_exec, \
         patch("libs.nexus.router.validate_result") as mock_val:

        mock_exec.return_value = ExecutionResult(
            task_id=sample_task.id,
            model_used="ollama",
            output="bad code",
            duration_ms=100,
        )
        # First validation fails badly
        mock_val.side_effect = [
            ValidationResult(task_id=sample_task.id, passed=False, score=0.4, issues=["broken"]),
            ValidationResult(task_id=sample_task.id, passed=True, score=0.9),
        ]

        result = await router.process_task(sample_task)
        assert mock_exec.call_count == 2  # Retried with strategic model
