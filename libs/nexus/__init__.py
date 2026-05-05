# libs.nexus package
"""
Nexus Smart Router Framework

Turbo-local AI framework for intelligent task routing between
local Ollama models and cloud LLMs (Kimi K2.6, etc).

Usage:
    from libs.nexus import classify_task, execute_task, validate_result
    
    task = Task(description="Implement rate limit", files=["apps/api/context.py"])
    classification = classify_task(task)
    result = execute_task(task, classification)
    validation = validate_result(task, result)
"""
from .models import Task, Classification, ExecutionResult, ValidationResult
from .classifier import classify_task
from .executor import execute_task
from .validator import validate_result
from .router import SmartRouter

__all__ = [
    "Task",
    "Classification", 
    "ExecutionResult",
    "ValidationResult",
    "classify_task",
    "execute_task",
    "validate_result",
    "SmartRouter",
]
