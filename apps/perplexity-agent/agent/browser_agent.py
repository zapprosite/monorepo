"""Browser agent using browser-use + OpenRouter (GPT-4o-mini)."""
import os
import subprocess

from browser_use import Agent
from langchain_openai import ChatOpenAI


def _get_infisical_secret(secret_key: str) -> str:
    value = os.environ.get(secret_key)
    if value is None:
        raise RuntimeError(f"Secret {secret_key} not found in environment — ensure .env is synced from Infisical")
    return value


def get_openrouter_key() -> str:
    """Fetch OPENROUTER_API_KEY from Infisical."""
    return _get_infisical_secret("OPENROUTER_API_KEY")


def get_llm() -> ChatOpenAI:
    """OpenRouter with GPT-4o-mini — best cost/benefit for browser agent."""
    api_key = get_openrouter_key()
    return ChatOpenAI(
        model="openai/gpt-4o-mini",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )


def get_agent(chrome_profile_path: str = "/srv/data/perplexity-agent/chrome-profile"):
    """Create browser-use Agent with Chrome profile persistence."""
    llm = get_llm()
    return Agent(
        task="You are a helpful web browsing assistant.",
        llm=llm,
        chrome_profile_path=chrome_profile_path,
    )


def test_connection():
    """Test LLM connection."""
    llm = get_llm()
    response = llm.invoke("Say OK in 3 letters", max_tokens=20)
    return f"GPT-4o-mini (OpenRouter): {response.content}"
