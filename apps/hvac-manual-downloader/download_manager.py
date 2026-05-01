"""Download manager - orchestrates all brand downloaders."""
import logging
from pathlib import Path
from typing import Optional

from agent.browser_agent import get_agent, get_llm
from agent.chrome_profile import (
    get_profile_path,
    has_valid_session,
    list_sessions,
    mark_session_invalid,
    mark_session_valid,
)
from agent.credentials import BrandCredentials
from config import BRAND_DIRS, get_download_dir
from tasks import daikin_downloader, lg_downloader, samsung_downloader, springer_downloader

logger = logging.getLogger(__name__)

# Task builders per brand
BRAND_TASK_BUILDERS = {
    "lg": lg_downloader.build_download_task,
    "samsung": samsung_downloader.build_download_task,
    "daikin": daikin_downloader.build_download_task,
    "springer": springer_downloader.build_download_task,
}


class DownloadManager:
    """Orchestrates HVAC manual downloads across brands."""

    def __init__(self, brand: str):
        self.brand = brand
        if brand not in BRAND_DIRS:
            raise ValueError(f"Unknown brand: {brand}")
        self.download_dir = get_download_dir(brand)
        self.profile_path = get_profile_path(brand)

    def ensure_session(func):
        """Decorator to ensure valid session before download."""
        def wrapper(self, *args, **kwargs):
            if not has_valid_session(self.brand):
                raise RuntimeError(
                    f"No valid session for {self.brand}. Run login first."
                )
            return func(self, *args, **kwargs)
        return wrapper

    @ensure_session
    def download_manual(self, model: str) -> Path:
        """Download manual for a single model."""
        creds = BrandCredentials(self.brand)
        output_path = f"{self.download_dir}/{model}.pdf"

        task_builder = BRAND_TASK_BUILDERS[self.brand]
        task = task_builder(
            model=model,
            email=creds.email,
            password=creds.password,
            output_path=output_path,
        )

        agent = get_agent(self.profile_path)
        logger.info(f"Downloading manual for {model}...")
        agent.run(task)

        result_path = Path(output_path)
        if result_path.exists():
            mark_session_valid(self.brand)
            logger.info(f"Downloaded: {output_path}")
            return result_path
        else:
            raise RuntimeError(f"Download failed: {output_path} not found")

    @ensure_session
    def batch_download(self, models: list[str]) -> list[Path]:
        """Download manuals for multiple models."""
        creds = BrandCredentials(self.brand)
        output_dir = self.download_dir

        task_builder = BRAND_TASK_BUILDERS[self.brand]
        if len(models) == 1:
            task = task_builder(
                model=models[0],
                email=creds.email,
                password=creds.password,
                output_path=f"{output_dir}/{models[0]}.pdf",
            )
        else:
            task = f"Download service manuals for models: {', '.join(models)}. Save to {output_dir}"

        agent = get_agent(self.profile_path)
        logger.info(f"Batch downloading {len(models)} manuals...")
        agent.run(task)

        downloaded = []
        for model in models:
            path = Path(f"{output_dir}/{model}.pdf")
            if path.exists():
                downloaded.append(path)
            else:
                logger.warning(f"Missing: {path}")

        return downloaded

    def login(self) -> None:
        """Perform initial login to establish session."""
        creds = BrandCredentials(self.brand)
        profile_path = self.profile_path

        task = f"""
Navigate to the brand support page and log in with:
Email: {creds.email}
Password: {creds.password}

After successful login, verify session is saved.
"""
        agent = get_agent(profile_path)
        logger.info(f"Logging in to {self.brand}...")
        agent.run(task)
        mark_session_valid(self.brand)
        logger.info(f"Session established for {self.brand}")

    def status(self) -> dict:
        """Get status of all sessions."""
        return list_sessions()


def get_manager(brand: str) -> DownloadManager:
    """Factory for DownloadManager."""
    return DownloadManager(brand)
