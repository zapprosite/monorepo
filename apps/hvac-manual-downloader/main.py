"""HVAC Manual Downloader - CLI entry point."""
import argparse
import json
import logging
import sys
from pathlib import Path

from agent.chrome_profile import list_sessions
from config import ensure_directories
from download_manager import get_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def cmd_login(brand: str) -> None:
    """Establish login session for brand."""
    ensure_directories()
    manager = get_manager(brand)
    manager.login()
    print(f"Login complete for {brand}")


def cmd_download(brand: str, model: str) -> None:
    """Download manual for a single model."""
    ensure_directories()
    manager = get_manager(brand)
    path = manager.download_manual(model)
    print(f"Downloaded: {path}")


def cmd_batch(brand: str, models_file: str) -> None:
    """Batch download from models file."""
    ensure_directories()
    models_data = json.loads(Path(models_file).read_text())
    models = models_data.get("models", [])
    if not models:
        print("No models found in file")
        sys.exit(1)

    manager = get_manager(brand)
    downloaded = manager.batch_download(models)
    print(f"Downloaded {len(downloaded)}/{len(models)} manuals")


def cmd_status() -> None:
    """Show status of all brand sessions."""
    sessions = list_sessions()
    for brand, info in sessions.items():
        status = "VALID" if info.get("valid") else "INVALID"
        print(f"  {brand}: {status}")


def cmd_process(input_dir: str, output_dir: str) -> None:
    """Process downloaded PDFs (placeholder for SPEC-032 integration)."""
    print(f"Processing PDFs from {input_dir} -> {output_dir}")
    print("NOTE: SPEC-032 (docling) integration is a separate step")


def main():
    parser = argparse.ArgumentParser(description="HVAC Manual Downloader")
    sub = parser.add_subparsers(dest="command")

    # Login command
    login_parser = sub.add_parser("login", help="Login to brand support")
    login_parser.add_argument("--brand", required=True, choices=["lg", "samsung", "daikin", "springer"])

    # Download command
    dl_parser = sub.add_parser("download", help="Download single manual")
    dl_parser.add_argument("--brand", required=True, choices=["lg", "samsung", "daikin", "springer"])
    dl_parser.add_argument("--model", required=True, help="Model number")

    # Batch command
    batch_parser = sub.add_parser("batch", help="Batch download")
    batch_parser.add_argument("--brand", required=True, choices=["lg", "samsung", "daikin", "springer"])
    batch_parser.add_argument("--models-file", required=True, help="JSON file with models list")

    # Status command
    sub.add_parser("status", help="Show session status")

    # Process command
    process_parser = sub.add_parser("process", help="Process downloaded PDFs")
    process_parser.add_argument("--input", required=True)
    process_parser.add_argument("--output", required=True)

    args = parser.parse_args()

    if args.command == "login":
        cmd_login(args.brand)
    elif args.command == "download":
        cmd_download(args.brand, args.model)
    elif args.command == "batch":
        cmd_batch(args.brand, args.models_file)
    elif args.command == "status":
        cmd_status()
    elif args.command == "process":
        cmd_process(args.input, args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
