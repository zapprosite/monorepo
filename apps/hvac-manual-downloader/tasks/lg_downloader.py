"""LG Brazil task downloader."""
from pathlib import Path

SUPPORT_URL = "https://www.lg.com/br/suporte/manuais"


# Model patterns for LG Brazil
LG_MODEL_PATTERNS = [
    r"AR-\d{2}NS\d",  # AR-09NS1, AR-12NS1, etc.
    r"AR-\d{2}NW\d",  # AR-09NW1, etc.
    r"UT-\d{2}NE\d",  # UT-09NE1, etc.
]


TASK_TEMPLATES = {
    "search_and_download": """
1. Navigate to {url}
2. If login required:
   - Enter email: {email}
   - Enter password: {password}
3. Search for model: {model}
4. Find the service manual PDF
5. Click download button
6. Wait for download to complete (timeout: 60s)
7. Save file to: {output_path}
""",
    "batch_search": """
1. Navigate to {url}
2. For each model in list: {models}
3. Download each service manual PDF
4. Save to: {output_dir}
""",
}


def build_download_task(model: str, email: str, password: str, output_path: str) -> str:
    """Build download task for a single model."""
    return TASK_TEMPLATES["search_and_download"].format(
        url=SUPPORT_URL,
        email=email,
        password=password,
        model=model,
        output_path=output_path,
    )


def build_batch_task(models: list[str], email: str, password: str, output_dir: str) -> str:
    """Build batch download task."""
    return TASK_TEMPLATES["batch_search"].format(
        url=SUPPORT_URL,
        email=email,
        password=password,
        models=", ".join(models),
        output_dir=output_dir,
    )
