"""Config for HVAC Manual Downloader."""
import os

# Base directories
DATA_BASE = "/srv/data/hvac-manual-downloader"
MANUALS_OUTPUT = "/srv/data/hvac-manuals"

# Paths
CHROME_PROFILES_BASE = f"{DATA_BASE}/chrome-profiles"
DOWNLOADS_BASE = f"{DATA_BASE}/downloads"
LOGS_DIR = f"{DATA_BASE}/logs"
STATE_DIR = f"{DATA_BASE}/state"

# Per-brand download directories
BRAND_DIRS = {
    "lg": f"{MANUALS_OUTPUT}/lg",
    "samsung": f"{MANUALS_OUTPUT}/samsung",
    "daikin": f"{MANUALS_OUTPUT}/daikin",
    "springer": f"{MANUALS_OUTPUT}/springer",
}

# Infisical
INFISICAL_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV = "dev"
TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"


def ensure_directories():
    """Ensure all required directories exist."""
    for path in [CHROME_PROFILES_BASE, DOWNLOADS_BASE, LOGS_DIR, STATE_DIR]:
        os.makedirs(path, exist_ok=True)
    for brand_dir in BRAND_DIRS.values():
        os.makedirs(brand_dir, exist_ok=True)


def get_download_dir(brand: str) -> str:
    """Get download directory for brand."""
    return BRAND_DIRS.get(brand, f"{MANUALS_OUTPUT}/{brand}")
