"""Browser agent using browser-use + OpenRouter (GPT-4o-mini)."""
from browser_use import Agent
from langchain_openai import ChatOpenAI

from agent.credentials import get_openrouter_key


def get_llm() -> ChatOpenAI:
    """OpenRouter with GPT-4o-mini for browser automation."""
    api_key = get_openrouter_key()
    return ChatOpenAI(
        model="openai/gpt-4o-mini",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )


def get_agent(chrome_profile_path: str):
    """Create browser-use Agent with Chrome profile persistence."""
    llm = get_llm()
    return Agent(
        task="You are a helpful HVAC web browsing assistant that downloads service manuals.",
        llm=llm,
        chrome_profile_path=chrome_profile_path,
    )


def test_connection() -> str:
    """Test LLM connection."""
    llm = get_llm()
    response = llm.invoke("Say OK in 3 letters", max_tokens=20)
    return f"GPT-4o-mini (OpenRouter): {response.content}"
