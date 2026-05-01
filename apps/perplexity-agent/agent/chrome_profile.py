"""Chrome profile management for browser agent."""
import os
from pathlib import Path

CHROME_PROFILE_PATH = os.environ.get(
    "CHROME_PROFILE_PATH",
    "/srv/data/perplexity-agent/chrome-profile"
)


def ensure_chrome_profile() -> Path:
    """Ensure Chrome profile directory exists."""
    profile_dir = Path(CHROME_PROFILE_PATH)
    profile_dir.mkdir(parents=True, exist_ok=True)
    return profile_dir


def get_chrome_profile_args() -> list[str]:
    """Get Playwright Chrome arguments for persistent profile."""
    ensure_chrome_profile()
    return [
        f"--user-data-dir={CHROME_PROFILE_PATH}",
    ]
