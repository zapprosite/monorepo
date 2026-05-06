#!/usr/bin/env python3
"""HVAC Manual Downloader — Minimal script for downloading service manuals.

Extracted from apps/hvac-manual-downloader (pruned 2026-05-04).
Uses browser-use + LiteLLM nexus-auto for browser automation.
"""
import argparse
import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BRAND_SITES = {
    "lg": "https://www.lg.com/br/suporte",
    "samsung": "https://www.samsung.com/br/support",
    "daikin": "https://www.daikin.com.br/suporte",
    "springer": "https://www.springer.com.br/suporte",
}

DOWNLOAD_DIR = Path("/srv/data/hvac-manuals")


def download_manual(brand: str, model: str) -> Path:
    """Download manual for a specific brand/model."""
    if brand not in BRAND_SITES:
        raise ValueError(f"Unknown brand: {brand}")

    brand_dir = DOWNLOAD_DIR / brand
    brand_dir.mkdir(parents=True, exist_ok=True)
    output_path = brand_dir / f"{model}.pdf"

    logger.info(f"Downloading {brand} {model} -> {output_path}")
    # TODO: implement browser-use logic or curl fallback
    logger.warning("Manual download requires browser-use integration. Use HVAC scraper pipeline.")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="HVAC Manual Downloader")
    parser.add_argument("--brand", required=True, choices=list(BRAND_SITES.keys()))
    parser.add_argument("--model", required=True, help="Model number (e.g., AR-09NS1)")
    args = parser.parse_args()

    path = download_manual(args.brand, args.model)
    print(f"Target: {path}")


if __name__ == "__main__":
    main()
