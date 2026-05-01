"""Browser agent using browser-use + Groq (free tier)."""
import os

from browser_use import Agent
from browser_use.browser.profile import BrowserProfile
from langchain_openai import ChatOpenAI

from agent.credentials import get_groq_key


def get_llm() -> ChatOpenAI:
    """Groq with llama-3.3-70b-versatile for browser automation (free, fast)."""
    api_key = get_groq_key()
    return ChatOpenAI(
        model="llama-3.3-70b-versatile",
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )


def get_browser_profile(headless: bool = True, user_data_dir: str = None) -> BrowserProfile:
    """Build BrowserProfile with Docker-safe Chrome flags.

    CHROME_EXTRA_ARGS env var controls extra flags, e.g.:
        --no-sandbox --disable-dev-shm-usage --disable-gpu
    Set automatically by docker-compose.scraper.yml.

    PLAYWRIGHT_HEADLESS=1 forces headless mode (no display required).

    user_data_dir enables persistent Chrome profile (cookies, session).
    """
    extra_args_env = os.environ.get("CHROME_EXTRA_ARGS", "")
    extra_chromium_args = [a for a in extra_args_env.split() if a]

    # Ensure minimum safe flags for container execution when running headless.
    if headless:
        for flag in ("--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"):
            if flag not in extra_chromium_args:
                extra_chromium_args.append(flag)

    return BrowserProfile(
        headless=headless,
        extra_chromium_args=extra_chromium_args,
        user_data_dir=user_data_dir,
    )


def get_agent(chrome_profile_path: str):
    """Create browser-use Agent with Chrome profile persistence.

    When PLAYWRIGHT_HEADLESS=1 (set in docker-compose.scraper.yml) the agent
    runs fully headless with --no-sandbox so it works inside a container without
    a display server or host Chrome installation.

    chrome_profile_path is the user_data_dir for persistent Chrome profile.
    Session cookies are saved here for brand login persistence.
    """
    llm = get_llm()
    headless = os.environ.get("PLAYWRIGHT_HEADLESS", "0") == "1"
    browser_profile = get_browser_profile(headless=headless, user_data_dir=chrome_profile_path)
    return Agent(
        task="You are a helpful HVAC web browsing assistant that downloads service manuals.",
        llm=llm,
        browser_profile=browser_profile,
    )


def test_connection() -> str:
    """Test LLM connection."""
    llm = get_llm()
    response = llm.invoke("Say OK in 3 letters", max_tokens=20)
    return f"Groq (llama-3.3-70b-versatile): {response.content}"
