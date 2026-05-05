"""
test_sync_engine.py
Phase 2 — Tests for services.sync_engine
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure repo root is on path
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from services import sync_engine


def _make_temp_docs(tmp_path: Path):
    """Create temporary .md and .txt files for scanning."""
    d = tmp_path / "docs"
    d.mkdir()
    (d / "readme.md").write_text("# Hello")
    (d / "notes.txt").write_text("Some notes")
    (d / "ignore.py").write_text("print(1)")  # should be ignored
    return str(d)


def test_scan_sources_finds_md_and_txt(tmp_path):
    docs_dir = _make_temp_docs(tmp_path)
    docs = sync_engine.scan_sources([docs_dir])
    ids = {d["id"] for d in docs}
    assert "docs/readme.md" in ids
    assert "docs/notes.txt" in ids
    assert "docs/ignore.py" not in ids


def test_scan_sources_skips_missing_paths():
    docs = sync_engine.scan_sources(["/nonexistent/path/12345"])
    assert docs == []


def test_content_hash_deterministic():
    h1 = sync_engine._content_hash("same text")
    h2 = sync_engine._content_hash("same text")
    h3 = sync_engine._content_hash("different")
    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 64  # SHA-256 hex


@patch("services.sync_engine.requests.put")
@patch("services.sync_engine._embed")
def test_upsert_to_qdrant(mock_embed, mock_put):
    mock_embed.return_value = [0.1, 0.2, 0.3]
    mock_put.return_value = MagicMock()
    mock_put.return_value.raise_for_status = MagicMock()

    docs = [
        {
            "id": "doc-1",
            "text": "hello world",
            "hash": "abc123",
            "source": "/tmp/doc1.md",
        }
    ]
    sync_engine.upsert_to_qdrant(docs)

    mock_embed.assert_called_once_with("hello world")
    mock_put.assert_called_once()
    call_args = mock_put.call_args
    url = call_args[0][0]
    assert sync_engine.QDRANT_COLLECTION in url
    payload = call_args[1]["json"]
    assert len(payload["points"]) == 1
    assert payload["points"][0]["id"] == "doc-1"
    assert payload["points"][0]["payload"]["hash"] == "abc123"


@patch("services.sync_engine.upsert_to_qdrant")
@patch("services.sync_engine.scan_sources")
def test_run_sync_orchestrates(mock_scan, mock_upsert):
    mock_scan.return_value = [
        {"id": "a", "text": "t", "hash": "h", "source": "s"}
    ]
    sync_engine.run_sync(["/tmp/fake"])
    mock_scan.assert_called_once_with(["/tmp/fake"])
    mock_upsert.assert_called_once()


@patch("services.sync_engine.scan_sources")
def test_run_sync_no_docs(mock_scan):
    mock_scan.return_value = []
    # Should complete without calling upsert
    with patch.object(sync_engine, "upsert_to_qdrant") as mock_upsert:
        sync_engine.run_sync(["/tmp/empty"])
        mock_upsert.assert_not_called()
