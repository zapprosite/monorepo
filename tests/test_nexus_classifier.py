"""
test_nexus_classifier.py — Tests for Nexus classifier
"""
import pytest
from libs.nexus.classifier import _classify_heuristic
from libs.nexus.models import Task, TaskType


def test_heuristic_mechanical():
    task = Task(description="Format auth.py with black and add type hints")
    result = _classify_heuristic(task)
    assert result.level == TaskType.MECHANICAL
    assert result.recommended_model == "ollama-qwen2.5-coder"


def test_heuristic_strategic():
    task = Task(description="Design the authentication architecture from scratch")
    result = _classify_heuristic(task)
    assert result.level == TaskType.STRATEGIC
    assert result.recommended_model == "kimi-k2.6"


def test_heuristic_analytical():
    task = Task(description="Review this pull request for bugs")
    result = _classify_heuristic(task)
    assert result.level == TaskType.ANALYTICAL


def test_heuristic_many_files():
    task = Task(
        description="Fix formatting across all files",
        files=[f"file{i}.py" for i in range(15)],
    )
    result = _classify_heuristic(task)
    # Many files with formatting task → analytical with parallelization
    assert result.can_parallelize is True
