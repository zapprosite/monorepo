#!/srv/data/hvac-rag/.venv/bin/python3
"""HVAC Expansion Pipeline Orchestrator.

Runs the full pipeline with checkpoint-based resumability:
  step_sync_catalog       -> hvac_sync_inmetro_catalog.py
  step_normalize_catalog  -> hvac_normalize_inmetro_catalog.py
  step_generate_batch     -> generate_batch_file() inline
  step_scrape             -> hvac_manual_scraper.py --brand all --batch-file
  step_add_manuals        -> hvac_add_manual.py --index (per PDF in incoming/pdf/)
  step_coverage_report    -> hvac_missing_manuals.py --output-coverage

Usage:
  ./hvac_expansion_pipeline.py [--dry-run] [--reset-checkpoint] [--from-step STEP] [--report-only]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
COLLECTION_NAME = os.environ.get("HVAC_COLLECTION", "hvac_manuals_v1")
HVAC_REPORTS_DIR = Path(os.environ.get("HVAC_REPORTS_DIR", "/srv/data/hvac-rag/reports"))
HVAC_INMETRO_CATALOG = Path(os.environ.get(
    "HVAC_INMETRO_CATALOG",
    "/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl",
))
CHECKPOINT_PATH = Path(os.environ.get(
    "HVAC_CHECKPOINT",
    "/srv/data/hvac-rag/catalog/pipeline_checkpoint.json",
))
SCRIPTS_DIR = Path(__file__).parent.resolve()
INCOMING_PDF_DIR = Path(os.environ.get(
    "HVAC_INCOMING_PDF_DIR",
    "/srv/data/hvac-rag/incoming/pdf",
))
BATCH_FILE = HVAC_REPORTS_DIR / "missing_models_batch.txt"
COVERAGE_REPORT = HVAC_REPORTS_DIR / "coverage_report.md"
PENDING_REVIEW = HVAC_REPORTS_DIR / "pending_review.jsonl"

TIER1_BRANDS = {"lg", "samsung", "daikin"}
SCRAPER_BRANDS = {"lg", "samsung", "daikin", "springer", "carrier"}


def load_checkpoint(path: Path) -> dict:
    """Load checkpoint JSON, or return default state dict."""
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            logger.warning("Checkpoint file corrupt or unreadable; starting fresh")
    return {"completed_steps": [], "pdf_status": {}, "started_at": None}


def save_checkpoint(path: Path, state: dict) -> None:
    """Write checkpoint atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.rename(path)


def step_done(state: dict, step: str) -> bool:
    """Return True if step was already completed in this checkpoint."""
    return step in state.get("completed_steps", [])


def mark_step_done(state: dict, step: str) -> None:
    """Mark a step as completed and persist checkpoint."""
    if "completed_steps" not in state:
        state["completed_steps"] = []
    if step not in state["completed_steps"]:
        state["completed_steps"].append(step)
    save_checkpoint(CHECKPOINT_PATH, state)


def log_pending_review(rec: dict, reason: str) -> None:
    """Append one entry to pending_review.jsonl for models that cannot be auto-scraped."""
    PENDING_REVIEW.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "model": rec.get("indoor_model") or rec.get("model", ""),
        "brand": rec.get("brand", ""),
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    with PENDING_REVIEW.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def generate_batch_file(
    catalog_path: Path | None,
    indexed_brands_models: set[str],
    output_path: Path,
) -> int:
    """Write missing scraper-supported models as brand:model lines."""
    if catalog_path is None or not catalog_path.exists():
        logger.warning("Catalog not found: %s", catalog_path)
        return 0

    tier1_lines: list[str] = []
    tier2_lines: list[str] = []

    with catalog_path.open(encoding="utf-8") as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError:
                continue

            brand = (rec.get("brand") or "").lower().strip()
            model = rec.get("indoor_model") or rec.get("model") or ""
            if not model:
                continue
            if brand not in SCRAPER_BRANDS:
                log_pending_review(rec, "no_scraper_support")
                continue

            model_family = (rec.get("model_family") or model).lower().strip()
            key = f"{brand}::{model_family}"
            if key in indexed_brands_models:
                continue

            entry = f"{brand}:{model}"
            if brand in TIER1_BRANDS:
                tier1_lines.append(entry)
            else:
                tier2_lines.append(entry)

    all_lines = tier1_lines + tier2_lines
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(all_lines) + ("\n" if all_lines else ""), encoding="utf-8")
    logger.info(
        "Batch file written: %s (%d entries, %d tier-1, %d tier-2)",
        output_path,
        len(all_lines),
        len(tier1_lines),
        len(tier2_lines),
    )
    return len(all_lines)


def run_step(cmd: list[str], step_name: str, dry_run: bool = False) -> bool:
    """Run a pipeline step as subprocess."""
    if dry_run:
        logger.info("[dry-run] step: %s - would run: %s", step_name, " ".join(str(c) for c in cmd))
        return True
    logger.info("Running step: %s", step_name)
    try:
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError as exc:
        logger.error("Step '%s' failed (exit %s)", step_name, exc.returncode)
        return False


def validate_environment(dry_run: bool = False) -> None:
    """Fail fast if required env vars are absent."""
    if dry_run:
        return
    if not QDRANT_API_KEY:
        sys.stderr.write("FATAL: QDRANT_API_KEY not set in environment\n")
        sys.stderr.write("  Set it with: export QDRANT_API_KEY=<key>\n")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="HVAC Expansion Pipeline - checkpointed batch expansion"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Simulate all steps without executing subprocesses")
    parser.add_argument("--reset-checkpoint", action="store_true",
                        help="Delete checkpoint and restart all steps from scratch")
    parser.add_argument("--from-step", type=str, default=None,
                        help="Force re-run from this step name, e.g. step_scrape")
    parser.add_argument("--report-only", action="store_true",
                        help="Run only step_coverage_report")
    args = parser.parse_args()

    validate_environment(dry_run=args.dry_run)

    if args.reset_checkpoint and CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()
        logger.info("Checkpoint reset; starting from step 1")

    state = load_checkpoint(CHECKPOINT_PATH)
    if not state.get("started_at"):
        state["started_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if not args.dry_run:
            save_checkpoint(CHECKPOINT_PATH, state)

    force_from = args.from_step
    forced = {"active": force_from is None}

    def should_run(step: str) -> bool:
        if args.report_only:
            return step == "step_coverage_report"
        if force_from and not forced["active"]:
            forced["active"] = step == force_from
        return forced["active"] and (args.from_step == step or not step_done(state, step))

    if should_run("step_sync_catalog"):
        ok = run_step(
            [sys.executable, str(SCRIPTS_DIR / "hvac_sync_inmetro_catalog.py")],
            "step_sync_catalog",
            dry_run=args.dry_run,
        )
        if ok:
            if not args.dry_run:
                mark_step_done(state, "step_sync_catalog")

    if should_run("step_normalize_catalog"):
        ok = run_step(
            [sys.executable, str(SCRIPTS_DIR / "hvac_normalize_inmetro_catalog.py")],
            "step_normalize_catalog",
            dry_run=args.dry_run,
        )
        if ok:
            if not args.dry_run:
                mark_step_done(state, "step_normalize_catalog")

    if should_run("step_generate_batch"):
        if args.dry_run:
            logger.info("[dry-run] step: step_generate_batch - would generate batch file")
        else:
            count = generate_batch_file(HVAC_INMETRO_CATALOG, set(), BATCH_FILE)
            logger.info("Batch file: %d models to scrape", count)
        if not args.dry_run:
            mark_step_done(state, "step_generate_batch")

    if should_run("step_scrape"):
        if BATCH_FILE.exists() or args.dry_run:
            ok = run_step(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "hvac_manual_scraper.py"),
                    "--brand",
                    "all",
                    "--batch-file",
                    str(BATCH_FILE),
                ],
                "step_scrape",
                dry_run=args.dry_run,
            )
            if ok:
                if not args.dry_run:
                    mark_step_done(state, "step_scrape")
        else:
            logger.warning("Batch file not found; skipping scrape step")

    if should_run("step_add_manuals"):
        if args.dry_run:
            logger.info("[dry-run] step: step_add_manuals - would process PDFs in incoming/pdf/")
        else:
            pdf_files = list(INCOMING_PDF_DIR.rglob("*.pdf")) if INCOMING_PDF_DIR.exists() else []
            logger.info("Found %d PDFs in %s", len(pdf_files), INCOMING_PDF_DIR)
            for pdf_path in sorted(pdf_files):
                pdf_key = str(pdf_path.relative_to(INCOMING_PDF_DIR))
                if state.get("pdf_status", {}).get(pdf_key) in ("accepted", "rejected"):
                    logger.debug("Skipping already-processed PDF: %s", pdf_key)
                    continue
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPTS_DIR / "hvac_add_manual.py"),
                        "--index",
                        str(pdf_path),
                    ],
                    check=False,
                )
                if "pdf_status" not in state:
                    state["pdf_status"] = {}
                state["pdf_status"][pdf_key] = "accepted" if result.returncode == 0 else "rejected"
                save_checkpoint(CHECKPOINT_PATH, state)
        if not args.dry_run:
            mark_step_done(state, "step_add_manuals")

    if should_run("step_coverage_report"):
        ok = run_step(
            [
                sys.executable,
                str(SCRIPTS_DIR / "hvac_missing_manuals.py"),
                "--output-coverage",
                str(COVERAGE_REPORT),
            ],
            "step_coverage_report",
            dry_run=args.dry_run,
        )
        if ok:
            if not args.dry_run:
                mark_step_done(state, "step_coverage_report")
            if not args.dry_run:
                logger.info("Coverage report: %s", COVERAGE_REPORT)

    logger.info("Pipeline complete.")


if __name__ == "__main__":
    main()
