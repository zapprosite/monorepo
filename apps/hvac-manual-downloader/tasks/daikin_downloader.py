"""Daikin Brasil task downloader."""
SUPPORT_URL = "https://www.daikin.com.br/profissionais/downloads"


# Model patterns for Daikin Brasil
DAIKIN_MODEL_PATTERNS = [
    r"FTXB\d{2}",  # FTXB35, FTXB50
    r"RXB\d{2}",   # RXB35, RXB50
]


TASK_TEMPLATES = {
    "search_and_download": """
1. Navigate to {url}
2. If login required:
   - Enter email: {email}
   - Enter password: {password}
3. Select product category: {category}
4. Search for model: {model}
5. Find the service manual PDF
6. Click download button
7. Wait for download to complete (timeout: 60s)
8. Save file to: {output_path}
""",
}


def build_download_task(
    model: str,
    email: str,
    password: str,
    output_path: str,
    category: str = "Split Systems",
) -> str:
    """Build download task for a single model."""
    return TASK_TEMPLATES["search_and_download"].format(
        url=SUPPORT_URL,
        email=email,
        password=password,
        category=category,
        model=model,
        output_path=output_path,
    )
