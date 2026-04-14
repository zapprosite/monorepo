"""Browser agent using browser-use + OpenRouter (GPT-4o-mini)."""
import os
import subprocess

from browser_use import Agent
from langchain_openai import ChatOpenAI


def _get_infisical_secret(secret_key: str) -> str:
    """Fetch a secret from Infisical vault."""
    token_path = "/srv/ops/secrets/infisical.service-token"
    script = f"""
from infisical_sdk import InfisicalSDKClient
import os
token = os.environ.get('INFISICAL_TOKEN') or open('{token_path}').read().strip()
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id=os.environ.get('INFISICAL_PROJECT_ID', 'e42657ef-98b2-4b9c-9a04-46c093bd6d37'),
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == '{secret_key}':
        print(s.secret_value)
        break
"""
    result = subprocess.run(
        ["python3", "-c", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch {secret_key}: {result.stderr}")
    return result.stdout.strip()


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
