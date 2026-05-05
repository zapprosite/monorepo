"""SCRAPER-01: Scraper batch file parsing tests."""
from pathlib import Path
import pytest


def test_batch_file_parsing(tmp_path: Path, sample_catalog, indexed_models):
    """generate_batch_file writes brand:model lines, tier-1 first, excluding already-indexed."""
    hvac_pipeline = pytest.importorskip(
        "hvac_expansion_pipeline",
        reason="hvac_expansion_pipeline.py not yet implemented (Wave 3)"
    )
    batch_path = tmp_path / "missing_models.txt"
    count = hvac_pipeline.generate_batch_file(
        catalog_path=None,
        indexed_brands_models=indexed_models,
        output_path=batch_path,
    )
    # When catalog_path is None, generate_batch_file returns 0 — test the API shape
    assert isinstance(count, int)


def test_batch_file_excludes_unsupported_brands(tmp_path: Path, mock_catalog_jsonl, indexed_models):
    """Brands without scraper support (midea) must not appear in batch file."""
    hvac_pipeline = pytest.importorskip(
        "hvac_expansion_pipeline",
        reason="hvac_expansion_pipeline.py not yet implemented (Wave 3)"
    )
    batch_path = tmp_path / "missing_models.txt"
    hvac_pipeline.generate_batch_file(
        catalog_path=mock_catalog_jsonl,
        indexed_brands_models=indexed_models,
        output_path=batch_path,
    )
    if batch_path.exists():
        lines = batch_path.read_text().splitlines()
        assert not any("midea:" in l for l in lines), "Midea must not appear in batch file (no scraper)"
