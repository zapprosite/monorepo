"""PIPELINE-01: Checkpoint resume logic in hvac_expansion_pipeline.py."""
import json
from pathlib import Path
import pytest


def test_load_checkpoint_returns_empty_when_no_file(tmp_path):
    """load_checkpoint returns default structure when file does not exist."""
    hvac_pipeline = pytest.importorskip(
        "hvac_expansion_pipeline",
        reason="hvac_expansion_pipeline.py not yet implemented (Wave 3)"
    )
    cp = hvac_pipeline.load_checkpoint(tmp_path / "nonexistent.json")
    assert cp["completed_steps"] == []
    assert cp["pdf_status"] == {}
    assert cp["started_at"] is None


def test_mark_step_done_appends_and_persists(tmp_path):
    """mark_step_done appends step name and saves checkpoint to disk."""
    hvac_pipeline = pytest.importorskip("hvac_expansion_pipeline", reason="Wave 3")
    checkpoint_file = tmp_path / "checkpoint.json"
    original = hvac_pipeline.CHECKPOINT_PATH
    hvac_pipeline.CHECKPOINT_PATH = checkpoint_file
    try:
        cp = hvac_pipeline.load_checkpoint(checkpoint_file)
        hvac_pipeline.mark_step_done(cp, "sync_catalog")
        assert "sync_catalog" in cp["completed_steps"]
        on_disk = json.loads(checkpoint_file.read_text())
        assert "sync_catalog" in on_disk["completed_steps"]
    finally:
        hvac_pipeline.CHECKPOINT_PATH = original


def test_step_done_returns_true_for_completed(tmp_path):
    """step_done returns True for a step that was previously marked."""
    hvac_pipeline = pytest.importorskip("hvac_expansion_pipeline", reason="Wave 3")
    checkpoint_file = tmp_path / "checkpoint.json"
    original = hvac_pipeline.CHECKPOINT_PATH
    hvac_pipeline.CHECKPOINT_PATH = checkpoint_file
    try:
        cp = hvac_pipeline.load_checkpoint(checkpoint_file)
        hvac_pipeline.mark_step_done(cp, "normalize_catalog")
        assert hvac_pipeline.step_done(cp, "normalize_catalog") is True
        assert hvac_pipeline.step_done(cp, "scraper_batch") is False
    finally:
        hvac_pipeline.CHECKPOINT_PATH = original


def test_reset_clears_checkpoint(tmp_path):
    """After --reset, a fresh checkpoint must have empty completed_steps."""
    hvac_pipeline = pytest.importorskip("hvac_expansion_pipeline", reason="Wave 3")
    checkpoint_file = tmp_path / "checkpoint.json"
    original = hvac_pipeline.CHECKPOINT_PATH
    hvac_pipeline.CHECKPOINT_PATH = checkpoint_file
    try:
        cp = hvac_pipeline.load_checkpoint(checkpoint_file)
        hvac_pipeline.mark_step_done(cp, "sync_catalog")
        hvac_pipeline.mark_step_done(cp, "normalize_catalog")
        fresh = {"completed_steps": [], "pdf_status": {}, "started_at": None}
        hvac_pipeline.save_checkpoint(checkpoint_file, fresh)
        reloaded = hvac_pipeline.load_checkpoint(checkpoint_file)
        assert reloaded["completed_steps"] == []
    finally:
        hvac_pipeline.CHECKPOINT_PATH = original
