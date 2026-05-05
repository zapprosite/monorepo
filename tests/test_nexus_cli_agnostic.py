"""
test_nexus_cli_agnostic.py — Tests for CLI-agnostic behavior
"""
import os
import pytest
from unittest.mock import patch, MagicMock

from libs.nexus.config import detect_cli_model, get_primary_model, get_local_model
from libs.nexus.classifier import _classify_heuristic
from libs.nexus.models import Task, TaskType


class TestCliDetection:
    """Test that Nexus detects the invoking CLI correctly."""

    def test_detect_opencode(self):
        env = {"NEXUS_CLI_MODEL": "", "OPENCODE_MODEL": "kimi-k2.6", "CODEX_MODEL": "", "CLAUDE_CODE_MODEL": "", "AIDER_MODEL": ""}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "kimi-k2.6"

    def test_detect_codex(self):
        env = {"NEXUS_CLI_MODEL": "", "OPENCODE_MODEL": "", "CODEX_MODEL": "gpt-4o", "CLAUDE_CODE_MODEL": "", "AIDER_MODEL": ""}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "gpt-4o"

    def test_detect_claude(self):
        env = {"NEXUS_CLI_MODEL": "", "OPENCODE_MODEL": "", "CODEX_MODEL": "", "CLAUDE_CODE_MODEL": "claude-sonnet-4", "AIDER_MODEL": ""}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "claude-sonnet-4"

    def test_detect_aider(self):
        env = {"NEXUS_CLI_MODEL": "", "OPENCODE_MODEL": "", "CODEX_MODEL": "", "CLAUDE_CODE_MODEL": "", "AIDER_MODEL": "deepseek-v3"}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "deepseek-v3"

    def test_explicit_cli_model_override(self):
        env = {"NEXUS_CLI_MODEL": "custom-model", "OPENCODE_MODEL": "kimi", "CODEX_MODEL": "", "CLAUDE_CODE_MODEL": "", "AIDER_MODEL": ""}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "custom-model"

    def test_fallback(self):
        env = {"NEXUS_CLI_MODEL": "", "OPENCODE_MODEL": "", "CODEX_MODEL": "", "CLAUDE_CODE_MODEL": "", "AIDER_MODEL": "", "NEXUS_OLLAMA_FAST": "hermes-auto"}
        with patch.dict(os.environ, env, clear=True):
            assert detect_cli_model() == "hermes-auto"


class TestModelResolution:
    """Test that primary/local models resolve correctly."""

    def test_get_primary_model(self):
        env = {"NEXUS_CLI_MODEL": "gpt-4o", "NEXUS_OLLAMA_FAST": "hermes-auto"}
        with patch.dict(os.environ, env, clear=True):
            assert get_primary_model() == "gpt-4o"

    def test_get_local_model(self):
        env = {"NEXUS_OLLAMA_CODE": "qwen2.5-coder"}
        with patch.dict(os.environ, env, clear=True):
            assert get_local_model() == "qwen2.5-coder"


class TestHeuristicCliAgnostic:
    """Test that classifier produces CLI-agnostic recommendations."""

    def test_strategic_uses_resolved_model(self):
        env = {"NEXUS_CLI_MODEL": "claude-opus", "NEXUS_OLLAMA_CODE": "qwen2.5-coder"}
        with patch.dict(os.environ, env, clear=True):
            task = Task(description="Design the authentication architecture")
            result = _classify_heuristic(task)
            assert result.level == TaskType.STRATEGIC
            assert result.recommended_model == "claude-opus"

    def test_mechanical_uses_local(self):
        env = {"NEXUS_CLI_MODEL": "claude-opus", "NEXUS_OLLAMA_CODE": "qwen2.5-coder"}
        with patch.dict(os.environ, env, clear=True):
            task = Task(description="Format auth.py with black and add type hints")
            result = _classify_heuristic(task)
            assert result.level == TaskType.MECHANICAL
            assert result.recommended_model == "qwen2.5-coder"
