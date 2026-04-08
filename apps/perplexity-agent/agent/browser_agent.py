"""Browser agent using browser-use + OpenRouter (GPT-4o-mini) with fallbacks."""
import subprocess
from typing import Any, Optional

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
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == '{secret_key}':
        print(s.secret_value)
        break
"""
    result = subprocess.run(
        ["/usr/bin/python3", "-c", script],
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


def get_minimax_token() -> str:
    """Fetch MINIMAX_TOKEN (sk-cp-) from Infisical."""
    return _get_infisical_secret("MINIMAX_TOKEN")


# ── LLM Providers ─────────────────────────────────────────────────────────────

def get_llm_openrouter() -> Optional[ChatOpenAI]:
    """OpenRouter with GPT-4o-mini — best cost/benefit for browser agent."""
    try:
        api_key = get_openrouter_key()
        return ChatOpenAI(
            model="openai/gpt-4o-mini",
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    except Exception as e:
        print(f"OpenRouter unavailable: {e}")
        return None


def get_llm_minimax() -> Optional[ChatOpenAI]:
    """MiniMax via Anthropic-compatible endpoint."""
    try:
        api_key = get_minimax_token()
        from langchain_anthropic import ChatAnthropic

        class MiniMaxChat(ChatAnthropic):
            def _generate(self, messages, stop=None, run_manager=None, **kwargs):
                response = super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
                # Filter thinking blocks
                from langchain_core.outputs import ChatGeneration, ChatResult
                from langchain_core.messages import AIMessage
                gens = response.generations
                if not gens or not gens[0]:
                    return response
                gen = gens[0][0] if isinstance(gens[0], list) else gens[0]
                msg: AIMessage = gen.message if hasattr(gen, 'message') else gen
                if isinstance(msg.content, list):
                    text_parts = [
                        b.text if (isinstance(b, dict) and b.get('type') == 'text')
                        else (b.text if hasattr(b, 'type') and b.type == 'text' else str(b))
                        for b in msg.content
                        if (isinstance(b, dict) and b.get('type') == 'text') or
                           (hasattr(b, 'type') and b.type == 'text')
                    ]
                    msg.content = "\n".join(text_parts) if text_parts else ""
                filtered_gen = ChatGeneration(text=str(msg.content), message=msg)
                return ChatResult(generations=[filtered_gen])

        return MiniMaxChat(
            model="MiniMax-M2.7",
            anthropic_api_key=api_key,
            base_url="https://api.minimax.io/anthropic",
        )
    except Exception as e:
        print(f"MiniMax unavailable: {e}")
        return None


def get_llm():
    """Get best available LLM: OpenRouter GPT-4o-mini → MiniMax → Ollama."""
    # 1. OpenRouter GPT-4o-mini (best for function calling, cheapest)
    llm = get_llm_openrouter()
    if llm:
        try:
            llm.invoke("hi", max_tokens=5)
            print("Using OpenRouter GPT-4o-mini")
            return llm
        except Exception as e:
            print(f"OpenRouter failed: {e}")

    # 2. MiniMax via Anthropic endpoint
    llm = get_llm_minimax()
    if llm:
        try:
            llm.invoke("hi", max_tokens=5)
            print("Using MiniMax M2.7")
            return llm
        except Exception as e:
            print(f"MiniMax failed: {e}")

    # 3. Ollama fallback
    from langchain_ollama import ChatOllama
    print("Falling back to Ollama Qwen3-14B-Q4")
    return ChatOllama(model="qwen3:14b", base_url="http://127.0.0.1:11434")


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
