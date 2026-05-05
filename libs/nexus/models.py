"""
Nexus Models — Pydantic data structures
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from enum import Enum


class TaskType(str, Enum):
    """Classification of task complexity."""
    MECHANICAL = "mechanical"      # Simple, well-defined (Ollama)
    ANALYTICAL = "analytical"      # Requires analysis (Ollama + validation)
    STRATEGIC = "strategic"        # Complex decisions (Kimi K2.6)


class Classification(BaseModel):
    """Output of task classification."""
    level: TaskType = Field(description="Complexity level")
    confidence: float = Field(ge=0.0, le=1.0, description="Classification confidence")
    estimated_tokens: int = Field(ge=0, description="Estimated token consumption")
    recommended_model: str = Field(description="Recommended model alias")
    reason: str = Field(description="Why this classification was chosen")
    can_parallelize: bool = Field(default=False, description="Whether subtasks can run in parallel")
    subtasks: List[str] = Field(default_factory=list, description="Decomposed subtasks if applicable")


class Task(BaseModel):
    """A unit of work for Nexus."""
    id: str = Field(default_factory=lambda: f"task-{__import__('uuid').uuid4().hex[:8]}")
    description: str = Field(description="What needs to be done")
    files: List[str] = Field(default_factory=list, description="Target files")
    test_cmd: Optional[str] = Field(default=None, description="Command to verify")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    priority: int = Field(default=1, ge=1, le=5, description="1=low, 5=critical")
    max_iterations: int = Field(default=3, ge=1, le=10)


class ExecutionResult(BaseModel):
    """Result of task execution."""
    task_id: str
    model_used: str
    output: str
    files_modified: List[str] = Field(default_factory=list)
    test_passed: Optional[bool] = None
    test_output: Optional[str] = None
    tokens_used: int = 0
    duration_ms: int = 0
    attempts: int = 1
    error: Optional[str] = None


class ValidationResult(BaseModel):
    """Quality gate validation."""
    task_id: str
    passed: bool
    score: float = Field(ge=0.0, le=1.0)
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    validator_model: str = "kimi-k2.6"
