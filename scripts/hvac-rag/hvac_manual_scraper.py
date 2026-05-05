#!/srv/data/hvac-rag/.venv/bin/python3
"""
HVAC Manual Scraper — Download service manuals from manufacturer support sites.

Supports: lg, samsung, daikin, springer, carrier
Downloads to: /srv/data/hvac-rag/incoming/pdf/

Usage:
  python3 hvac_manual_scraper.py --brand lg --model "AR-09NS1" [--out-dir PATH]
  python3 hvac_manual_scraper.py --brand all --batch-file models.txt
  python3 hvac_manual_scraper.py --brand lg --list-models
"""
import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, quote_plus

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_OUT_DIR = Path("/srv/data/hvac-rag/incoming/pdf")
MANIFEST_PATH = Path("/srv/data/hvac-rag/manifests/scraper_manifest.jsonl")
REQUEST_TIMEOUT = 30
RATE_LIMIT_SECONDS = 2.0
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

BRAND_CONFIG = {
    "lg": {
        "search_url": "https://www.lg.com/br/suporte/search",
        "manual_base": "https://www.lg.com",
        "search_param": "search",
        "link_selector": "a[href*='manual']",
        "file_ext": ".pdf",
    },
    "samsung": {
        "search_url": "https://www.samsung.com/br/support/download",
        "manual_base": "https://www.samsung.com",
        "search_param": "keyword",
        "link_selector": "a[href$='.pdf']",
        "file_ext": ".pdf",
    },
    "daikin": {
        "search_url": "https://www.daikin.com.br/suporte/documentacao",
        "manual_base": "https://www.daikin.com.br",
        "search_param": "search",
        "link_selector": "a[href$='.pdf']",
        "file_ext": ".pdf",
    },
    "springer": {
        "search_url": "https://www.springer.com.br/suporte/manuais",
        "manual_base": "https://www.springer.com.br",
        "search_param": "q",
        "link_selector": "a[href$='.pdf']",
        "file_ext": ".pdf",
    },
    "carrier": {
        "search_url": "https://www.carrier.com/commercial/pt/br/support/literature",
        "manual_base": "https://www.carrier.com",
        "search_param": "search",
        "link_selector": "a[href$='.pdf']",
        "file_ext": ".pdf",
    },
}

# ── Helpers ──────────────────────────────────────────────────────────────────


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_scraper_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        return []
    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def save_scraper_manifest_entry(entry: dict) -> None:
    ensure_dir(MANIFEST_PATH.parent)
    with MANIFEST_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def is_already_downloaded(sha256_hash: str) -> bool:
    manifest = load_scraper_manifest()
    return any(m.get("sha256") == sha256_hash for m in manifest)


def download_file(url: str, dest: Path, retries: int = MAX_RETRIES) -> Path | None:
    """Download a file with retries and rate limiting."""
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Downloading {url} (attempt {attempt}/{retries})")
            time.sleep(RATE_LIMIT_SECONDS)
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT, stream=True)
            resp.raise_for_status()
            with dest.open("wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info(f"Saved {dest} ({dest.stat().st_size} bytes)")
            return dest
        except requests.exceptions.HTTPError as e:
            if resp.status_code == 404:
                logger.warning(f"File not found (404): {url}")
                return None
            logger.warning(f"HTTP error {resp.status_code} on attempt {attempt}: {e}")
        except Exception as e:
            logger.warning(f"Download error on attempt {attempt}: {e}")
    logger.error(f"Failed to download after {retries} attempts: {url}")
    return None


def extract_pdf_links(html: str, selector: str, base_url: str) -> list[str]:
    """Extract absolute PDF URLs from HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for tag in soup.select(selector):
        href = tag.get("href")
        if not href:
            continue
        href = href.strip()
        if not href.lower().endswith(".pdf"):
            continue
        absolute = urljoin(base_url, href)
        links.append(absolute)
    return links


# ── Brand scrapers ───────────────────────────────────────────────────────────


def search_and_download(brand: str, model: str, out_dir: Path) -> Path | None:
    """Search for a manual and download it."""
    config = BRAND_CONFIG.get(brand)
    if not config:
        logger.error(f"Unknown brand: {brand}")
        return None

    brand_dir = out_dir / brand
    ensure_dir(brand_dir)

    # Build search URL
    query = quote_plus(model)
    search_url = f"{config['search_url']}?{config['search_param']}={query}"

    logger.info(f"Searching {brand.upper()} for model '{model}': {search_url}")

    try:
        time.sleep(RATE_LIMIT_SECONDS)
        resp = requests.get(search_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Search failed for {brand} {model}: {e}")
        return None

    pdf_links = extract_pdf_links(resp.text, config["link_selector"], config["manual_base"])
    if not pdf_links:
        logger.warning(f"No PDF links found for {brand} {model}")
        return None

    # Download the first match (most relevant)
    for link in pdf_links[:3]:
        filename = Path(link).name
        if not filename.lower().endswith(".pdf"):
            filename = f"{brand}_{model.replace(' ', '_')}.pdf"
        dest = brand_dir / filename

        downloaded = download_file(link, dest)
        if downloaded:
            sha = file_sha256(downloaded)
            if is_already_downloaded(sha):
                logger.info(f"Duplicate detected (sha256={sha[:16]}...), skipping.")
                downloaded.unlink()
                return None
            entry = {
                "brand": brand,
                "model": model,
                "filename": filename,
                "source_url": link,
                "local_path": str(downloaded),
                "sha256": sha,
                "size_bytes": downloaded.stat().st_size,
                "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            save_scraper_manifest_entry(entry)
            logger.info(f"Scraped {brand} {model} -> {downloaded}")
            return downloaded

    logger.warning(f"All PDF links failed for {brand} {model}")
    return None


def list_models(brand: str) -> list[str]:
    """Placeholder: list popular models for a brand."""
    popular = {
        "lg": ["AR-09NS1", "AR-12NS1", "AR-18NS1", "AR-24NS1", "S4-Q09WA51A"],
        "samsung": ["AR09TSHZ", "AR12TSHZ", "AR18TSHZ", "AR24TSHZ", "WindFree"],
        "daikin": ["FTXS25K", "FTXS35K", "FTXS50K", "FTXS60K", "VRV-IV"],
        "springer": ["42LUQC07S5", "42LUQC09S5", "42LUQC12S5", "42LUQC18S5"],
        "carrier": ["38MBC009", "38MBC012", "38MBC018", "38MBC024", "40MBC"],
    }
    return popular.get(brand, [])


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="HVAC Manual Scraper")
    parser.add_argument("--brand", required=True, choices=list(BRAND_CONFIG.keys()) + ["all"], help="Brand or 'all'")
    parser.add_argument("--model", help="Model number (e.g., AR-09NS1)")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory")
    parser.add_argument("--batch-file", type=Path, help="File with one 'brand:model' per line")
    parser.add_argument("--list-models", action="store_true", help="List popular models for a brand")
    args = parser.parse_args()

    ensure_dir(args.out_dir)

    if args.list_models:
        if args.brand == "all":
            for b in BRAND_CONFIG:
                print(f"\n{b.upper()}:")
                for m in list_models(b):
                    print(f"  {m}")
        else:
            print(f"\n{args.brand.upper()}:")
            for m in list_models(args.brand):
                print(f"  {m}")
        return

    targets = []
    if args.batch_file:
        with args.batch_file.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(":", 1)
                if len(parts) == 2:
                    targets.append((parts[0].strip(), parts[1].strip()))
    elif args.model:
        if args.brand == "all":
            logger.error("--model requires a specific --brand (not 'all')")
            sys.exit(1)
        targets.append((args.brand, args.model))
    else:
        logger.error("Provide --model or --batch-file")
        sys.exit(1)

    success = 0
    fail = 0
    for brand, model in targets:
        result = search_and_download(brand, model, args.out_dir)
        if result:
            success += 1
        else:
            fail += 1

    logger.info(f"Scraping complete: {success} succeeded, {fail} failed")


if __name__ == "__main__":
    main()
