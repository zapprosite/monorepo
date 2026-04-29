"""Springer/Midea task downloader."""
SUPPORT_URL = "https://www.springer-placeholder.com.br"  # Placeholder - to be verified


# Model patterns for Springer/Midea
SPRINGER_MODEL_PATTERNS = [
    r"Xtreme Save Connect \d+K",
    r"Xtreme Inverter \d+K",
    r"Martian \d+K",
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
