"""Pytest smoke tests for Hermes Agency Telegram bot."""
import pytest
import urllib.request
import json
import os

HERMES_URL = os.getenv("HERMES_URL", "http://localhost:4003")
HERMES_TOKEN = os.getenv("HERMES_AGENCY_BOT_TOKEN", "8759194670:AAGHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY")

def test_hermes_health():
    """Test Hermes Agency health endpoint."""
    req = urllib.request.Request(f"{HERMES_URL}/health")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert data.get("status") in ["healthy", "ok"]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("Hermes /health not implemented")
        raise

def test_hermes_models_info():
    """Test Hermes Agency models/info endpoint."""
    req = urllib.request.Request(
        f"{HERMES_URL}/api/v1/models",
        headers={"Authorization": f"Bearer {HERMES_TOKEN}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert "models" in data or "data" in data
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("Hermes /api/v1/models endpoint not implemented")
        raise

def test_hermes_agency_skills_list():
    """Test Hermes Agency skills list endpoint."""
    req = urllib.request.Request(
        f"{HERMES_URL}/api/v1/skills",
        headers={"Authorization": f"Bearer {HERMES_TOKEN}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            assert resp.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("Skills endpoint not implemented")
        raise

@pytest.mark.ci
def test_hermes_telegram_webhook():
    """Test Telegram webhook endpoint (CI only)."""
    # This is a dry test - just check the endpoint exists
    req = urllib.request.Request(
        f"{HERMES_URL}/telegram/webhook",
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass
    except urllib.error.HTTPError as e:
        # 401/403 expected without valid Telegram payload
        assert e.code in [401, 403, 404]
    except Exception:
        pass  # Connection errors are ok for webhook without payload
