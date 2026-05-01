"""Chrome profile management for HVAC manual downloader."""
import json
import os
from pathlib import Path
from typing import Optional

# Base path for all brand profiles
CHROME_PROFILES_BASE = "/srv/data/hvac-manual-downloader/chrome-profiles"

# Per-brand profiles
BRAND_PROFILES = {
    "lg": f"{CHROME_PROFILES_BASE}/lg",
    "samsung": f"{CHROME_PROFILES_BASE}/samsung",
    "daikin": f"{CHROME_PROFILES_BASE}/daikin",
    "springer": f"{CHROME_PROFILES_BASE}/springer",
}

# Session state file
STATE_DIR = "/srv/data/hvac-manual-downloader/state"
SESSION_STATE_FILE = f"{STATE_DIR}/session_state.json"


def ensure_brand_profile(brand: str) -> Path:
    """Ensure Chrome profile directory exists for brand."""
    if brand not in BRAND_PROFILES:
        raise ValueError(f"Unknown brand: {brand}. Valid: {list(BRAND_PROFILES.keys())}")
    profile_dir = Path(BRAND_PROFILES[brand])
    profile_dir.mkdir(parents=True, exist_ok=True)
    return profile_dir


def get_chrome_profile_args(brand: str) -> list[str]:
    """Get Playwright Chrome arguments for persistent profile."""
    ensure_brand_profile(brand)
    return [
        f"--user-data-dir={BRAND_PROFILES[brand]}",
    ]


def _ensure_state_dir() -> Path:
    """Ensure state directory exists."""
    state_dir = Path(STATE_DIR)
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir


def _load_session_state() -> dict:
    """Load session state from disk."""
    state_file = Path(SESSION_STATE_FILE)
    if not state_file.exists():
        return {}
    try:
        return json.loads(state_file.read_text())
    except (json.JSONDecodeError, IOError):
        return {}


def _save_session_state(state: dict) -> None:
    """Save session state to disk."""
    _ensure_state_dir()
    Path(SESSION_STATE_FILE).write_text(json.dumps(state, indent=2))


def has_valid_session(brand: str) -> bool:
    """Check if brand has a valid session."""
    state = _load_session_state()
    brand_state = state.get(brand, {})
    return brand_state.get("valid", False)


def mark_session_valid(brand: str) -> None:
    """Mark brand session as valid."""
    state = _load_session_state()
    state[brand] = {"valid": True}
    _save_session_state(state)


def mark_session_invalid(brand: str) -> None:
    """Mark brand session as invalid."""
    state = _load_session_state()
    state[brand] = {"valid": False}
    _save_session_state(state)


def get_session_info(brand: str) -> Optional[dict]:
    """Get session info for brand."""
    state = _load_session_state()
    return state.get(brand)


def list_sessions() -> dict:
    """List all brand sessions with status."""
    state = _load_session_state()
    result = {}
    for brand in BRAND_PROFILES:
        result[brand] = state.get(brand, {"valid": False})
    return result


def get_profile_path(brand: str) -> str:
    """Get Chrome profile path for brand."""
    return BRAND_PROFILES[brand]
