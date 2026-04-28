#!/usr/bin/env python3
"""
Pytest tests for hvac-healthcheck.py and hvac-daily-smoke.py

Run: cd /srv/monorepo && pytest tests/test_healthcheck.py -v
"""

import asyncio
import json
import sys
import os
import types
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path
import importlib.util

import pytest

# =============================================================================
# Setup: Define paths for module imports
# =============================================================================
SCRIPTS_DIR = Path("/srv/monorepo/scripts")
SCRIPTS_HVAC_DIR = SCRIPTS_DIR / "hvac-rag"

# =============================================================================
# Import modules under test with bug fixes applied
# =============================================================================

# hvac-healthcheck.py has a bug: expects .juiz but module exports .judge
# hvac-daily-smoke.py has the same pattern but uses .judge correctly
# We fix by modifying source before execution

def load_module_with_fixes(module_name: str, filepath: Path) -> types.ModuleType:
    """Load a module from file, applying source fixes for known bugs."""
    with open(filepath) as f:
        source = f.read()

    # Fix: hvac-healthcheck.py line 46: juez = _juez_mod.juiz -> _juez_mod.judge
    source = source.replace('juiz = _juez_mod.juiz', 'juiz = _juez_mod.judge')

    mod = types.ModuleType(module_name)
    mod.__file__ = str(filepath)
    mod.__name__ = module_name

    # Execute with httpx mocked to avoid network calls
    with patch("httpx.AsyncClient"):
        exec(compile(source, str(filepath), 'exec'), mod.__dict__)

    sys.modules[module_name] = mod
    return mod

hvac_healthcheck = load_module_with_fixes("hvac_healthcheck", SCRIPTS_HVAC_DIR / "hvac-healthcheck.py")
hvac_daily_smoke = load_module_with_fixes("hvac_daily_smoke", SCRIPTS_HVAC_DIR / "hvac-daily-smoke.py")

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_httpx_async_client():
    """Mock httpx.AsyncClient for all HTTP calls."""
    with patch("httpx.AsyncClient") as mock:
        yield mock


@pytest.fixture
def mock_health_response():
    """Mock successful /health endpoint response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.elapsed.total_seconds.return_value = 0.05
    return mock_response


@pytest.fixture
def mock_models_response():
    """Mock successful /v1/models endpoint response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [
            {"id": "hvac-manual-strict", "object": "model"},
            {"id": "gpt-4o-mini", "object": "model"},
        ]
    }
    mock_response.elapsed.total_seconds.return_value = 0.08
    return mock_response


@pytest.fixture
def mock_qdrant_response():
    """Mock successful Qdrant collection response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "result": {
            "points_count": 12345,
            "status": "green",
        }
    }
    mock_response.elapsed.total_seconds.return_value = 0.12
    return mock_response


@pytest.fixture
def mock_chat_response():
    """Mock successful chat completions response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "RYYQ48BRA error E6 indicates an inverter compressor issue. "
                              "Check the inverter board and capacitors."
                }
            }
        ],
        "fallback": False,
    }
    mock_response.elapsed.total_seconds.return_value = 1.5
    return mock_response


@pytest.fixture
def mock_health_fail_response():
    """Mock failed /health endpoint response."""
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.elapsed.total_seconds.return_value = 0.01
    return mock_response


# =============================================================================
# Tests: hvac_healthcheck.check_health_endpoint()
# =============================================================================

@pytest.mark.asyncio
async def test_check_health_endpoint_pass(mock_httpx_async_client, mock_health_response):
    """Test check_health_endpoint returns pass on 200 response."""
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_health_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_health_endpoint()

    assert result["status"] == "pass"
    assert result["endpoint"] == "/health"
    assert "latency_ms" in result
    assert result["latency_ms"] > 0


@pytest.mark.asyncio
async def test_check_health_endpoint_fail(mock_httpx_async_client, mock_health_fail_response):
    """Test check_health_endpoint returns fail on non-200 response."""
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_health_fail_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_health_endpoint()

    assert result["status"] == "fail"
    assert result["endpoint"] == "/health"
    assert "error" in result


@pytest.mark.asyncio
async def test_check_health_endpoint_connection_refused(mock_httpx_async_client):
    """Test check_health_endpoint returns fail on connection refused."""
    import httpx

    mock_client = AsyncMock()
    mock_client.get.side_effect = httpx.ConnectError("Connection refused")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_health_endpoint()

    assert result["status"] == "fail"
    assert result["endpoint"] == "/health"
    assert "connection refused" in result["error"].lower()


# =============================================================================
# Tests: hvac_healthcheck.check_models_endpoint()
# =============================================================================

@pytest.mark.asyncio
async def test_check_models_endpoint_pass(mock_httpx_async_client, mock_models_response):
    """Test check_models_endpoint returns model list on 200 response."""
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_models_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_models_endpoint()

    assert result["status"] == "pass"
    assert result["endpoint"] == "/v1/models"
    assert "models_available" in result
    assert result["models_available"] == 2


@pytest.mark.asyncio
async def test_check_models_endpoint_returns_model_list(mock_httpx_async_client, mock_models_response):
    """Test check_models_endpoint returns correct model count."""
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_models_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_models_endpoint()

    assert result["status"] == "pass"
    assert result["models_available"] >= 0


@pytest.mark.asyncio
async def test_check_models_endpoint_fail(mock_httpx_async_client):
    """Test check_models_endpoint returns fail on error."""
    import httpx

    mock_client = AsyncMock()
    mock_client.get.side_effect = httpx.ConnectError("Connection refused")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_models_endpoint()

    assert result["status"] == "fail"
    assert result["endpoint"] == "/v1/models"


# =============================================================================
# Tests: hvac_healthcheck.check_qdrant_collection() [connectivity]
# =============================================================================

@pytest.mark.asyncio
async def test_check_qdrant_connectivity_pass(mock_httpx_async_client, mock_qdrant_response):
    """Test check_qdrant_collection returns pass when Qdrant is reachable."""
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_qdrant_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_qdrant_collection()

    assert result["status"] == "pass"
    assert result["collection"] == "hvac_manuals_v1"
    assert result["points_count"] == 12345


@pytest.mark.asyncio
async def test_check_qdrant_connectivity_fail(mock_httpx_async_client):
    """Test check_qdrant_collection returns fail when Qdrant is unreachable."""
    import httpx

    mock_client = AsyncMock()
    mock_client.get.side_effect = httpx.ConnectError("Connection refused")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_qdrant_collection()

    assert result["status"] == "fail"
    assert result["collection"] == "hvac_manuals_v1"


# =============================================================================
# Tests: hvac_healthcheck.check_juiz_validation()
# =============================================================================

@pytest.mark.asyncio
async def test_check_juiz_validation_approved(mock_httpx_async_client):
    """Test check_juiz_validation returns APPROVED for valid HVAC query."""
    with patch.object(hvac_healthcheck, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "valid hvac query", "latency_ms": 0.5})

        result = await hvac_healthcheck.check_juiz_validation()

        assert result["status"] == "pass"
        assert result["juiz_result"] == "APPROVED"


@pytest.mark.asyncio
async def test_check_juiz_validation_blocked(mock_httpx_async_client):
    """Test check_juiz_validation returns BLOCKED for out-of-domain query."""
    with patch.object(hvac_healthcheck, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "BLOCKED"
        mock_juiz.return_value = (mock_result, {"reason": "out of domain", "latency_ms": 0.3})

        result = await hvac_healthcheck.check_juiz_validation()

        assert result["status"] == "pass"
        assert result["juiz_result"] == "BLOCKED"


@pytest.mark.asyncio
async def test_check_juiz_validation_error(mock_httpx_async_client):
    """Test check_juiz_validation returns fail on exception."""
    with patch.object(hvac_healthcheck, "juiz") as mock_juiz:
        mock_juiz.side_effect = Exception("Juiz error")

        result = await hvac_healthcheck.check_juiz_validation()

        assert result["status"] == "fail"
        assert "error" in result


# =============================================================================
# Tests: hvac_healthcheck.check_field_tutor_endpoint()
# =============================================================================

@pytest.mark.asyncio
async def test_check_field_tutor_endpoint_pass(mock_httpx_async_client, mock_chat_response):
    """Test check_field_tutor_endpoint returns pass on 200 response."""
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_chat_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_field_tutor_endpoint()

    assert result["status"] == "pass"
    assert result["endpoint"] == "/v1/chat/completions/field-tutor"
    assert "query_hash" in result
    assert result["response_chars"] > 0


@pytest.mark.asyncio
async def test_check_field_tutor_endpoint_timeout(mock_httpx_async_client):
    """Test check_field_tutor_endpoint returns fail on timeout."""
    import httpx

    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timeout")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_field_tutor_endpoint()

    assert result["status"] == "fail"
    assert result["error"] == "timeout"


# =============================================================================
# Tests: hvac_healthcheck.check_printable_endpoint()
# =============================================================================

@pytest.mark.asyncio
async def test_check_printable_endpoint_pass(mock_httpx_async_client, mock_chat_response):
    """Test check_printable_endpoint returns pass on 200 response."""
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_chat_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_healthcheck.check_printable_endpoint()

    assert result["status"] == "pass"
    assert result["endpoint"] == "/v1/chat/completions/printable"
    assert "query_hash" in result


# =============================================================================
# Tests: hvac_healthcheck.run_healthcheck()
# =============================================================================

@pytest.mark.asyncio
async def test_run_healthcheck_all_pass(mock_httpx_async_client, mock_health_response, mock_models_response, mock_qdrant_response, mock_chat_response):
    """Test run_healthcheck returns overall pass when all checks pass."""
    def create_mock_client():
        client = AsyncMock()
        client.get.return_value = mock_health_response
        client.post.return_value = mock_chat_response
        return client

    mock_client = AsyncMock()
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    # Mock all the HTTP calls
    async def mock_get(url, **kwargs):
        if "/health" in url:
            return mock_health_response
        if "/v1/models" in url:
            return mock_models_response
        if "/collections" in url:
            return mock_qdrant_response
        return mock_health_response

    async def mock_post(url, **kwargs):
        return mock_chat_response

    mock_client.get.side_effect = mock_get
    mock_client.post.side_effect = mock_post

    # Mock juiz
    with patch.object(hvac_healthcheck, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "ok", "latency_ms": 0.1})

        report = await hvac_healthcheck.run_healthcheck()

        assert "overall_status" in report
        assert "checks_passed" in report
        assert "checks_total" in report
        assert "checks" in report
        assert report["checks_total"] == 6


# =============================================================================
# Tests: hvac_daily_smoke.check_printable_format()
# =============================================================================

def test_check_printable_format_valid():
    """Test check_printable_format returns True for valid printable text."""
    text = "RYYQ48BRA Error E6\nCompressor inverter issue\nCheck the inverter board and capacitors."
    result = hvac_daily_smoke.check_printable_format(text)
    assert result is True


def test_check_printable_format_with_markdown():
    """Test check_printable_format returns False for markdown text."""
    text = "## Error E6\n**Bold** text\n```code block```"
    result = hvac_daily_smoke.check_printable_format(text)
    assert result is False


def test_check_printable_format_too_short():
    """Test check_printable_format returns False for text too short."""
    text = "Too short"
    result = hvac_daily_smoke.check_printable_format(text)
    assert result is False


def test_check_printable_format_with_qr_code():
    """Test check_printable_format allows QR: placeholder."""
    text = "Contact support.\nQR: SomeQRCodeContent\nMore text here to pass length check."
    result = hvac_daily_smoke.check_printable_format(text)
    assert result is True


# =============================================================================
# Tests: hvac_daily_smoke.judge_query()
# =============================================================================

@pytest.mark.asyncio
async def test_judge_query_returns_result():
    """Test judge_query returns judge result for a query."""
    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "valid", "latency_ms": 1.0})

        result = await hvac_daily_smoke.judge_query("RYYQ48BRA error E6")

        assert "query_hash" in result
        assert result["judge_result"] == "APPROVED"
        assert result["reason"] == "valid"
        assert result["latency_ms"] == 1.0


@pytest.mark.asyncio
async def test_judge_query_hash_consistency():
    """Test judge_query returns consistent hash for same query."""
    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "BLOCKED"
        mock_juiz.return_value = (mock_result, {"reason": "ood", "latency_ms": 0.5})

        result1 = await hvac_daily_smoke.judge_query("test query")
        result2 = await hvac_daily_smoke.judge_query("test query")

        assert result1["query_hash"] == result2["query_hash"]


# =============================================================================
# Tests: hvac_daily_smoke.call_chat_endpoint()
# =============================================================================

@pytest.mark.asyncio
async def test_call_chat_endpoint_ok(mock_httpx_async_client, mock_chat_response):
    """Test call_chat_endpoint returns ok status on 200 response."""
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_chat_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_daily_smoke.call_chat_endpoint("/v1/chat/completions", "test query")

    assert result["status"] == "ok"
    assert result["endpoint"] == "/v1/chat/completions"
    assert "query_hash" in result
    assert result["latency_ms"] > 0
    assert result["response_chars"] > 0


@pytest.mark.asyncio
async def test_call_chat_endpoint_timeout(mock_httpx_async_client):
    """Test call_chat_endpoint returns timeout status on timeout."""
    import httpx

    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timeout")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_daily_smoke.call_chat_endpoint("/v1/chat/completions", "test query")

    assert result["status"] == "timeout"


@pytest.mark.asyncio
async def test_call_chat_endpoint_connection_error(mock_httpx_async_client):
    """Test call_chat_endpoint returns connection_error on connect failure."""
    import httpx

    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.ConnectError("Connection refused")
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    result = await hvac_daily_smoke.call_chat_endpoint("/v1/chat/completions", "test query")

    assert result["status"] == "connection_error"


# =============================================================================
# Tests: hvac_daily_smoke.run_smoke_test()
# =============================================================================

@pytest.mark.asyncio
async def test_run_smoke_test_processes_queries(mock_httpx_async_client, mock_chat_response):
    """Test run_smoke_test processes list of queries."""
    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "ok", "latency_ms": 0.1})

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_chat_response
        mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

        queries = ["RYYQ48BRA error E6", "FXAQ50FUV maintenance"]
        results = await hvac_daily_smoke.run_smoke_test(queries, "/v1/chat/completions", "positive")

        assert len(results) == 2
        assert all(r["category"] == "positive" for r in results)
        assert all("judge_result" in r for r in results)
        assert all("endpoint_status" in r for r in results)


# =============================================================================
# Tests: hvac_daily_smoke.run_printable_assertions()
# =============================================================================

@pytest.mark.asyncio
async def test_run_printable_assertions(mock_httpx_async_client, mock_chat_response):
    """Test run_printable_assertions runs checks on printable endpoint."""
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_chat_response
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    results = await hvac_daily_smoke.run_printable_assertions()

    assert isinstance(results, list)
    assert len(results) > 0
    assert all("query_hash" in r for r in results)


# =============================================================================
# Tests: hvac_daily_smoke.test_guided_triage()
# =============================================================================

@pytest.mark.asyncio
async def test_guided_triage(mock_httpx_async_client, mock_chat_response):
    """Test test_guided_triage processes guided triage queries."""
    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "GUIDED_TRIAGE"
        mock_juiz.return_value = (mock_result, {"reason": "needs triage", "latency_ms": 0.1})

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_chat_response
        mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

        results = await hvac_daily_smoke.test_guided_triage()

        assert isinstance(results, list)
        assert all("guided_triage_detected" in r for r in results)


# =============================================================================
# Tests: Daily smoke test report generation
# =============================================================================

@pytest.mark.asyncio
async def test_daily_smoke_runs_without_error(mock_httpx_async_client, mock_chat_response, tmp_path):
    """Test daily_smoke main function runs without error."""
    import httpx

    # Setup mocks for all HTTP calls
    mock_client = AsyncMock()

    async def mock_get(url, **kwargs):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"points_count": 100}}
        mock_response.elapsed.total_seconds.return_value = 0.1
        return mock_response

    async def mock_post(url, **kwargs):
        return mock_chat_response

    mock_client.get.side_effect = mock_get
    mock_client.post.side_effect = mock_post
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    # Mock juiz
    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "ok", "latency_ms": 0.1})

        # Run main function
        report_path = tmp_path / "smoke_report.json"
        report = await hvac_daily_smoke.main(str(report_path))

        # Verify report structure
        assert "summary" in report
        assert "query_results" in report
        assert "printable_results" in report
        assert "triage_results" in report
        assert "timestamp" in report["summary"]
        assert "total_queries" in report["summary"]
        assert "overall_status" in report["summary"]


@pytest.mark.asyncio
async def test_smoke_report_generation(mock_httpx_async_client, mock_chat_response, tmp_path):
    """Test smoke report is generated with correct structure."""
    mock_client = AsyncMock()

    async def mock_get(url, **kwargs):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"points_count": 100}}
        mock_response.elapsed.total_seconds.return_value = 0.1
        return mock_response

    async def mock_post(url, **kwargs):
        return mock_chat_response

    mock_client.get.side_effect = mock_get
    mock_client.post.side_effect = mock_post
    mock_httpx_async_client.return_value.__aenter__.return_value = mock_client

    with patch.object(hvac_daily_smoke, "juiz") as mock_juiz:
        mock_result = MagicMock()
        mock_result.value = "APPROVED"
        mock_juiz.return_value = (mock_result, {"reason": "ok", "latency_ms": 0.1})

        report_path = tmp_path / "smoke_report.json"
        report = await hvac_daily_smoke.main(str(report_path))

        # Verify summary fields
        summary = report["summary"]
        assert "blocked_count" in summary
        assert "ask_clarification_count" in summary
        assert "approved_count" in summary
        assert "fallback_used_count" in summary
        assert "printable_assertions_passed" in summary
        assert "printable_assertions_total" in summary
        assert "guided_triage_detected" in summary
        assert "guided_triage_total" in summary


# =============================================================================
# Tests: safe_query_hash helper
# =============================================================================

def test_safe_query_hash_consistency():
    """Test safe_query_hash returns consistent hashes."""
    query = "RYYQ48BRA error E6"
    hash1 = hvac_healthcheck.safe_query_hash(query)
    hash2 = hvac_healthcheck.safe_query_hash(query)
    assert hash1 == hash2


def test_safe_query_hash_different_queries():
    """Test safe_query_hash returns different hashes for different queries."""
    hash1 = hvac_healthcheck.safe_query_hash("query 1")
    hash2 = hvac_healthcheck.safe_query_hash("query 2")
    assert hash1 != hash2


def test_safe_query_hash_length():
    """Test safe_query_hash returns 8 character prefix."""
    query_hash = hvac_healthcheck.safe_query_hash("test query")
    assert len(query_hash) == 8


# =============================================================================
# Tests: qdrant_headers helper
# =============================================================================

def test_qdrant_headers_without_key():
    """Test qdrant_headers returns correct headers without API key."""
    with patch.dict(os.environ, {"QDRANT_API_KEY": ""}, clear=False):
        headers = hvac_healthcheck.qdrant_headers()
        assert "Authorization" in headers
        assert headers["Content-Type"] == "application/json"


def test_qdrant_headers_with_key():
    """Test qdrant_headers includes Bearer token with API key."""
    with patch.object(hvac_healthcheck, "QDRANT_API_KEY", "test-key-123"):
        headers = hvac_healthcheck.qdrant_headers()
        assert headers["Authorization"] == "Bearer test-key-123"
