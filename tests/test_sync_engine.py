"""
test_sync_engine.py
Phase 4 — Tests for services.sync_engine (async + hash skip)
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

import pytest

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


def _mock_aiohttp_session():
    """Return a mock aiohttp.ClientSession that works with async with."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = AsyncMock(return_value={})

    mock_post_cm = MagicMock()
    mock_post_cm.__aenter__ = AsyncMock(return_value=mock_response)
    mock_post_cm.__aexit__ = AsyncMock(return_value=False)

    mock_put_cm = MagicMock()
    mock_put_cm.__aenter__ = AsyncMock(return_value=mock_response)
    mock_put_cm.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.post = MagicMock(return_value=mock_post_cm)
    mock_session.put = MagicMock(return_value=mock_put_cm)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    return mock_session


@pytest.mark.asyncio
@patch("services.sync_engine.aiohttp.ClientSession")
@patch("services.sync_engine._fetch_existing_hashes", new_callable=AsyncMock)
@patch("services.sync_engine._embed", new_callable=AsyncMock)
async def test_upsert_to_qdrant_all_changed(mock_embed, mock_fetch_hashes, mock_session_cls):
    mock_embed.return_value = [0.1, 0.2, 0.3]
    mock_fetch_hashes.return_value = {}  # no existing hashes
    mock_session_cls.return_value = _mock_aiohttp_session()

    docs = [
        {
            "id": "doc-1",
            "text": "hello world",
            "hash": "abc123",
            "source": "/tmp/doc1.md",
        }
    ]
    await sync_engine.upsert_to_qdrant(docs)

    mock_embed.assert_called_once()
    mock_session_cls.return_value.put.assert_called_once()
    call_args = mock_session_cls.return_value.put.call_args
    assert sync_engine.QDRANT_COLLECTION in call_args[0][0]
    payload = call_args[1]["json"]
    assert len(payload["points"]) == 1
    assert payload["points"][0]["payload"]["hash"] == "abc123"


@pytest.mark.asyncio
@patch("services.sync_engine.aiohttp.ClientSession")
@patch("services.sync_engine._fetch_existing_hashes", new_callable=AsyncMock)
@patch("services.sync_engine._embed", new_callable=AsyncMock)
async def test_upsert_to_qdrant_skips_unchanged(mock_embed, mock_fetch_hashes, mock_session_cls):
    mock_embed.return_value = [0.1, 0.2, 0.3]
    mock_fetch_hashes.return_value = {"doc-1": "abc123", "doc-2": "unchanged"}
    mock_session_cls.return_value = _mock_aiohttp_session()

    docs = [
        {"id": "doc-1", "text": "hello world", "hash": "abc123", "source": "/tmp/d1.md"},
        {"id": "doc-2", "text": "same old", "hash": "unchanged", "source": "/tmp/d2.md"},
        {"id": "doc-3", "text": "new stuff", "hash": "def456", "source": "/tmp/d3.md"},
    ]
    await sync_engine.upsert_to_qdrant(docs)

    # Only doc-3 changed
    mock_embed.assert_called_once()
    assert mock_embed.call_args[0][1] == "new stuff"
    mock_session_cls.return_value.put.assert_called_once()
    payload = mock_session_cls.return_value.put.call_args[1]["json"]
    assert len(payload["points"]) == 1
    assert payload["points"][0]["id"] == "doc-3"


@pytest.mark.asyncio
@patch("services.sync_engine.aiohttp.ClientSession")
@patch("services.sync_engine._fetch_existing_hashes", new_callable=AsyncMock)
@patch("services.sync_engine._embed", new_callable=AsyncMock)
async def test_upsert_to_qdrant_all_unchanged(mock_embed, mock_fetch_hashes, mock_session_cls):
    mock_fetch_hashes.return_value = {"doc-1": "abc123"}
    mock_session_cls.return_value = _mock_aiohttp_session()

    docs = [
        {"id": "doc-1", "text": "hello", "hash": "abc123", "source": "/tmp/d1.md"},
    ]
    await sync_engine.upsert_to_qdrant(docs)

    mock_embed.assert_not_called()
    mock_session_cls.return_value.put.assert_not_called()


@patch("services.sync_engine.upsert_to_qdrant", new_callable=AsyncMock)
@patch("services.sync_engine.scan_sources")
def test_run_sync_orchestrates(mock_scan, mock_upsert):
    mock_scan.return_value = [
        {"id": "a", "text": "t", "hash": "h", "source": "s"}
    ]
    sync_engine.run_sync_sync(["/tmp/fake"])
    mock_scan.assert_called_once_with(["/tmp/fake"])
    mock_upsert.assert_called_once()


@patch("services.sync_engine.scan_sources")
def test_run_sync_no_docs(mock_scan):
    mock_scan.return_value = []
    # Should complete without calling upsert
    with patch.object(sync_engine, "upsert_to_qdrant", new_callable=AsyncMock) as mock_upsert:
        sync_engine.run_sync_sync(["/tmp/empty"])
        mock_upsert.assert_not_called()
