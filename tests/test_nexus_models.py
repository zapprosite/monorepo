"""
test_nexus_models.py — Tests for Nexus data models
"""
import pytest
from libs.nexus.models import Task, Classification, ExecutionResult, ValidationResult, TaskType


def test_task_defaults():
    t = Task(description="test task")
    assert t.description == "test task"
    assert t.files == []
    assert t.priority == 1
    assert t.max_iterations == 3
    assert t.id.startswith("task-")


def test_classification_validation():
    c = Classification(
        level=TaskType.ANALYTICAL,
        confidence=0.85,
        estimated_tokens=1500,
        recommended_model="ollama-qwen2.5-coder",
        reason="Medium complexity",
    )
    assert c.level == TaskType.ANALYTICAL
    assert c.confidence == 0.85


def test_execution_result_error():
    r = ExecutionResult(
        task_id="task-123",
        model_used="ollama",
        output="",
        error="Connection failed",
    )
    assert r.error == "Connection failed"
    assert r.test_passed is None


def test_validation_scoring():
    v = ValidationResult(
        task_id="task-123",
        passed=True,
        score=0.92,
        issues=[],
        suggestions=["Add more comments"],
    )
    assert v.score == 0.92
    assert v.passed is True
