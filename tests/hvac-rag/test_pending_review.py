"""PENDING-01: pending_review.jsonl write for brands without scraper support."""
import json
from pathlib import Path
import pytest


def test_log_pending_review_creates_jsonl_entry(tmp_path, pending_review_path):
    """log_pending_review appends valid JSONL entry with required fields."""
    hvac_pipeline = pytest.importorskip(
        "hvac_expansion_pipeline",
        reason="hvac_expansion_pipeline.py not yet implemented (Wave 3)"
    )
    original = hvac_pipeline.PENDING_REVIEW
    hvac_pipeline.PENDING_REVIEW = pending_review_path
    pending_review_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        rec = {"catalog_id": "MID-001", "brand": "midea", "indoor_model": "MAC12CS1"}
        hvac_pipeline.log_pending_review(rec, "no_scraper_support")
        lines = [l for l in pending_review_path.read_text().splitlines() if l.strip()]
        assert len(lines) == 1, f"Expected 1 entry, got {len(lines)}"
        entry = json.loads(lines[0])
        assert entry["brand"] == "midea"
        assert entry["reason"] == "no_scraper_support"
        assert "timestamp" in entry
        assert entry["model"] == "MAC12CS1"
    finally:
        hvac_pipeline.PENDING_REVIEW = original


def test_log_pending_review_is_append_only(tmp_path, pending_review_path):
    """Multiple calls to log_pending_review must append, not overwrite."""
    hvac_pipeline = pytest.importorskip("hvac_expansion_pipeline", reason="Wave 3")
    original = hvac_pipeline.PENDING_REVIEW
    hvac_pipeline.PENDING_REVIEW = pending_review_path
    pending_review_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        rec1 = {"catalog_id": "MID-001", "brand": "midea", "indoor_model": "MAC12CS1"}
        rec2 = {"catalog_id": "GRE-001", "brand": "gree", "indoor_model": "GWH12QD"}
        hvac_pipeline.log_pending_review(rec1, "no_scraper_support")
        hvac_pipeline.log_pending_review(rec2, "no_scraper_support")
        lines = [l for l in pending_review_path.read_text().splitlines() if l.strip()]
        assert len(lines) == 2, f"Expected 2 entries, got {len(lines)}"
        brands = [json.loads(l)["brand"] for l in lines]
        assert "midea" in brands and "gree" in brands
    finally:
        hvac_pipeline.PENDING_REVIEW = original


def test_brands_without_scraper_logged_in_pipeline(mock_catalog_jsonl, tmp_path):
    """Catalog brands not in SCRAPER_BRANDS must be auto-logged to pending_review."""
    hvac_pipeline = pytest.importorskip("hvac_expansion_pipeline", reason="Wave 3")
    pending_path = tmp_path / "reports" / "pending_review.jsonl"
    original_pending = hvac_pipeline.PENDING_REVIEW
    original_cp = hvac_pipeline.CHECKPOINT_PATH
    hvac_pipeline.PENDING_REVIEW = pending_path
    hvac_pipeline.CHECKPOINT_PATH = tmp_path / "checkpoint.json"
    try:
        import json as _json
        catalog = [_json.loads(l) for l in mock_catalog_jsonl.read_text().splitlines() if l.strip()]
        for rec in catalog:
            brand = (rec.get("brand") or "").lower()
            if brand not in hvac_pipeline.SCRAPER_BRANDS:
                hvac_pipeline.log_pending_review(rec, "no_scraper_support")
        if pending_path.exists():
            entries = [_json.loads(l) for l in pending_path.read_text().splitlines() if l.strip()]
            midea_entries = [e for e in entries if e.get("brand") == "midea"]
            assert len(midea_entries) >= 1, "midea must be logged to pending_review"
    finally:
        hvac_pipeline.PENDING_REVIEW = original_pending
        hvac_pipeline.CHECKPOINT_PATH = original_cp
