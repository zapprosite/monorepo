"""Browser agent using browser-use + MiniMax (with Ollama fallback)."""
import os
import subprocess
from typing import Any, List, Optional, Union

from browser_use import Agent
from langchain_anthropic import ChatAnthropic
from langchain_ollama import ChatOllama
from langchain_core.messages import AIMessage, BaseMessage


def get_minimax_token() -> str:
    """Fetch MINIMAX_TOKEN (sk-cp-) from Infisical."""
    token_path = "/srv/ops/secrets/infisical.service-token"
    script = """
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
    if s.secret_key == 'MINIMAX_TOKEN':
        print(s.secret_value)
        break
""".format(token_path=token_path)
    result = subprocess.run(
        ["/usr/bin/python3", "-c", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch MINIMAX_TOKEN: {result.stderr}")
    return result.stdout.strip()


def _filter_thinking(response: Any) -> Any:
    """Remove thinking blocks from MiniMax response, keep only text."""
    gens = response.generations
    if not gens or not gens[0]:
        raise ValueError("No generations in response")
    gen = gens[0][0] if isinstance(gens[0], list) else gens[0]
    msg: AIMessage = gen.message if hasattr(gen, 'message') else gen

    text_parts = []
    if isinstance(msg.content, list):
        for block in msg.content:
            if isinstance(block, dict):
                if block.get('type') == 'text':
                    text_parts.append(block['text'])
            elif hasattr(block, 'type') and block.type == 'text':
                text_parts.append(block.text)
    else:
        text_parts = [str(msg.content)]

    text = "\n".join(text_parts) if text_parts else ""

    # Return ChatResult with filtered message (flat generations list)
    from langchain_core.outputs import ChatGeneration, ChatResult
    filtered_msg = AIMessage(content=text)
    filtered_gen = ChatGeneration(text=text, message=filtered_msg)
    return ChatResult(generations=[filtered_gen])



class MiniMaxM2_7(ChatAnthropic):
    """ChatAnthropic wrapper that strips thinking blocks from MiniMax responses."""

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Union[list[str], None] = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> Any:
        response = super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        return _filter_thinking(response)


def get_llm_minimax() -> Optional[MiniMaxM2_7]:
    """Try to create MiniMax LLM. Returns None if API unavailable."""
    try:
        api_key = get_minimax_token()
        return MiniMaxM2_7(
            model="MiniMax-M2.7",
            anthropic_api_key=api_key,
            base_url="https://api.minimax.io/anthropic",
        )
    except Exception as e:
        print(f"MiniMax unavailable: {e}")
        return None


def get_llm_ollama() -> ChatOllama:
    """Create Ollama LLM as fallback."""
    return ChatOllama(
        model="qwen3:14b",
        base_url="http://127.0.0.1:11434",
    )


def get_llm():
    """Get best available LLM: MiniMax first, Ollama fallback."""
    llm = get_llm_minimax()
    if llm is None:
        print("Falling back to Ollama gemma4:latest")
        return get_llm_ollama()

    # Quick health check - try one call
    try:
        llm.invoke("hi", max_tokens=5)
        return llm
    except Exception as e:
        print(f"MiniMax API failed ({e}), falling back to Ollama")
        return get_llm_ollama()


def get_agent(chrome_profile_path: str = "/srv/data/perplexity-agent/chrome-profile"):
    """Create browser-use Agent with Chrome profile persistence."""
    llm = get_llm()
    agent = Agent(
        task="You are a helpful web browsing assistant.",
        llm=llm,
        chrome_profile_path=chrome_profile_path,
    )
    return agent


def test_connection():
    """Test LLM connection."""
    llm = get_llm()
    if isinstance(llm, ChatOllama):
        model = "gemma4:latest (Ollama)"
    else:
        model = "MiniMax-M2.7"
    response = llm.invoke("Say OK")
    return f"{model}: {response.content}"
