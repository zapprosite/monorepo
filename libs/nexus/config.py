"""
Nexus Config — CLI-agnostic environment configuration

Detects the active CLI and discovers its primary model automatically.
Never hardcodes a specific model — always reads from env/context.
"""
import os
from typing import Optional

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4018")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
HCE_API_URL = os.environ.get("HCE_API_URL", "http://localhost:8642")

# CLI Detection — which tool is invoking Nexus?
CLI_NAME = os.environ.get("NEXUS_CLI_NAME", "")  # opencode | codex | claude | aider
CLI_MODEL = os.environ.get("NEXUS_CLI_MODEL", "")  # kimi-k2.6 | gpt-4o | claude-sonnet-4

# Model aliases via LiteLLM (local gateway)
OLLAMA_CODE_MODEL = os.environ.get("NEXUS_OLLAMA_CODE", "hermes-local-code")
OLLAMA_FAST_MODEL = os.environ.get("NEXUS_OLLAMA_FAST", "hermes-auto")
CLOUD_FALLBACK_MODEL = os.environ.get("NEXUS_CLOUD_FALLBACK", "hermes-cloud-chat")

def detect_cli_model() -> str:
    """
    Detect the primary model from the invoking CLI.
    Priority:
      1. NEXUS_CLI_MODEL env var
      2. Detect from known CLI env vars
      3. Fallback to hermes-auto (LiteLLM will route)
    """
    # Always read fresh from os.environ (not cached constants)
    cli_model = os.environ.get("NEXUS_CLI_MODEL", "")
    if cli_model:
        return cli_model
    
    # OpenCode / opencode-cli
    if os.environ.get("OPENCODE_MODEL"):
        return os.environ.get("OPENCODE_MODEL")
    
    # Codex CLI
    if os.environ.get("CODEX_MODEL"):
        return os.environ.get("CODEX_MODEL")
    
    # Claude Code
    if os.environ.get("CLAUDE_CODE_MODEL"):
        return os.environ.get("CLAUDE_CODE_MODEL")
    
    # Aider
    if os.environ.get("AIDER_MODEL"):
        return os.environ.get("AIDER_MODEL")
    
    # Generic LLM model env
    if os.environ.get("LLM_MODEL"):
        return os.environ.get("LLM_MODEL")
    
    return os.environ.get("NEXUS_OLLAMA_FAST", "hermes-auto")


def get_primary_model() -> str:
    """The 'big' model — whatever the invoking CLI is using."""
    return detect_cli_model()


def get_local_model() -> str:
    """The 'fast/cheap' model — always Ollama local."""
    return os.environ.get("NEXUS_OLLAMA_CODE", "hermes-local-code")
