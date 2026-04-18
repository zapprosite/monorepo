"""
conftest.py — Fixtures pytest para Hermes Telegram smoke tests
SPEC-069: Bidirectional CLI + App PT-BR
"""

import os
import sys
from pathlib import Path

import pytest

# Adicionar smoke-tests ao path
sys.path.insert(0, str(Path(__file__).parent))


def pytest_addoption(parser):
    """Registar opções de linha de comando."""
    parser.addoption(
        "--interactive",
        action="store_true",
        default=False,
        help="Executar testes interactivos (que requerem utilizador humano)"
    )


def pytest_configure(config):
    """Registar markers."""
    config.addinivalue_line("markers", "interactive: Teste que requer utilizador humano (CLI + App)")
    config.addinivalue_line("markers", "ci: Teste fully automated (mocked responses)")
    config.addinivalue_line("markers", "cli: Teste CLI-only (sem Telegram App)")


def pytest_collection_modifyitems(config, items):
    """Por default, ignorar testes interactive se --interactive não está ativo."""
    if not config.getoption("--interactive"):
        skip_interactive = pytest.mark.skip(reason="Modo interactive: usa --interactive para executar")
        for item in items:
            if "interactive" in item.keywords:
                item.add_marker(skip_interactive)


# ─── Environment ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def env():
    """Variáveis de ambiente do teste."""
    return {
        "TELEGRAM_BOT_TOKEN": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
        "TEST_CHAT_ID": os.environ.get("TEST_CHAT_ID", ""),
        "HERMES_TELEGRAM_URL": os.environ.get("HERMES_TELEGRAM_URL", "http://localhost:8642"),
        "TEST_TIMEOUT": int(os.environ.get("TEST_TIMEOUT", "30")),
    }


@pytest.fixture(scope="session")
def hermes_url(env):
    """URL base do Hermes Telegram."""
    return env["HERMES_TELEGRAM_URL"]


@pytest.fixture(scope="session")
def test_timeout(env):
    """Timeout em segundos para operações."""
    return env["TEST_TIMEOUT"]
