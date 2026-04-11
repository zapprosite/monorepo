"""Browser agent using browser-use + MiniMax M2.7 via ChatAnthropic (base_url=api.minimax.io/anthropic)."""
import os

from browser_use import Agent
from browser_use.llm.anthropic.chat import ChatAnthropic
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, ListSecretsOptions

INFISICAL_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV = "dev"
TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"


def get_minimax_key() -> str:
    """Get MINIMAX_TOKEN from environment or Infisical vault."""
    env_token = os.environ.get("MINIMAX_TOKEN")
    if env_token:
        return env_token

    # Read token from mounted secrets
    try:
        with open(TOKEN_PATH, "r") as f:
            token = f.read().strip()
    except FileNotFoundError:
        raise RuntimeError(
            f"MINIMAX_TOKEN not set and {TOKEN_PATH} not found. "
            "Mount secrets or set MINIMAX_TOKEN env var."
        )

    settings = ClientSettings(
        access_token=token,
        site_url="http://127.0.0.1:8200",
    )
    client = InfisicalClient(settings=settings)

    options = ListSecretsOptions(
        environment=INFISICAL_ENV,
        project_id=INFISICAL_PROJECT_ID,
        path="/",
        recursive=True,
    )
    secrets = client.listSecrets(options)

    for s in secrets:
        if s.secret_key == "MINIMAX_TOKEN":
            return s.secret_value

    raise RuntimeError("MINIMAX_TOKEN not found in Infisical vault")


def get_llm() -> ChatAnthropic:
    """MiniMax M2.7 via browser-use ChatAnthropic with api.minimax.io/anthropic base URL."""
    return ChatAnthropic(
        model="MiniMax-M2.7",
        api_key=get_minimax_key(),
        base_url="https://api.minimax.io/anthropic",
        max_tokens=8192,
    )


def get_agent(chrome_profile_path: str = "/srv/data/perplexity-agent/chrome-profile"):
    """Create browser-use Agent with Chrome profile persistence."""
    llm = get_llm()
    return Agent(
        task="You are a helpful web browsing assistant.",
        llm=llm,
        chrome_profile_path=chrome_profile_path,
    )


async def test_connection() -> str:
    """Test LLM connection."""
    llm = get_llm()
    from browser_use.llm.messages import HumanMessage

    result = await llm.ainvoke([HumanMessage(content="Say OK in 3 letters")])
    return f"MiniMax-M2.7: {result.content}"
