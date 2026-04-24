"""Pytest conftest for monorepo smoke tests.

Features:
- Fallback ports for services that may run on different ports
- Connection test at session start to report which services are reachable
- Graceful test skipping when services are unavailable
"""
import pytest
import os
import socket
from urllib.parse import urlparse

# =============================================================================
# Environment variable defaults
# =============================================================================

os.environ.setdefault("LITELLM_URL", "http://localhost:4000")
os.environ.setdefault("LITELLM_KEY", "sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1")
os.environ.setdefault("MCP_MEMORY_URL", "http://localhost:4016")
os.environ.setdefault("QDRANT_URL", "http://10.0.19.5:6333")
os.environ.setdefault("QDRANT_API_KEY", "71cae77676e2a5fd552d172caa1c3200")
os.environ.setdefault("HERMES_URL", "http://localhost:4003")
os.environ.setdefault("HERMES_AGENCY_BOT_TOKEN", "8759194670:AAGHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY")

# =============================================================================
# Fallback port/host configurations
# =============================================================================

MCP_MEMORY_PORTS = [4016, 4001]
QDRANT_HOSTS = ["10.0.19.5", "10.0.9.2", "10.0.19.6"]
QDRANT_PORT = 6333

# =============================================================================
# Utility functions
# =============================================================================

def is_port_reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is reachable."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def discover_url(base_ports: list[int], default_url: str, service_name: str) -> tuple[str, bool]:
    """Try to discover a reachable URL by checking multiple ports on localhost.

    Returns (url, reached) tuple.
    """
    parsed = urlparse(default_url)
    host = parsed.hostname or "localhost"

    # If it's not localhost, just try the default
    if host != "localhost":
        if is_port_reachable(host, parsed.port or 80):
            return default_url, True
        return default_url, False

    # Try each port
    for port in base_ports:
        if is_port_reachable("localhost", port):
            scheme = parsed.scheme or "http"
            return f"{scheme}://localhost:{port}", True

    # Fallback to default
    return default_url, False


def discover_qdrant_url(default_url: str) -> tuple[str, bool]:
    """Try to discover a reachable Qdrant instance.

    Returns (url, reached) tuple.
    """
    parsed = urlparse(default_url)

    # Try configured host first
    if is_port_reachable(parsed.hostname or "localhost", parsed.port or 6333):
        return default_url, True

    # Try fallback hosts
    for host in QDRANT_HOSTS:
        if is_port_reachable(host, QDRANT_PORT):
            return f"http://{host}:{QDRANT_PORT}", True

    return default_url, False


# =============================================================================
# Service availability registry
# =============================================================================

class ServiceAvailability:
    """Registry of service availability discovered at session start."""

    def __init__(self):
        self.services: dict[str, bool] = {}
        self.urls: dict[str, str] = {}

    def register(self, name: str, url: str, reached: bool):
        self.services[name] = reached
        self.urls[name] = url

    def is_available(self, name: str) -> bool:
        return self.services.get(name, False)

    def get_url(self, name: str) -> str:
        return self.urls.get(name, "")

    def summary(self) -> str:
        lines = ["Service availability:"]
        for name, reached in self.services.items():
            status = "OK" if reached else "UNAVAILABLE"
            url = self.urls.get(name, "")
            lines.append(f"  [{status}] {name} -> {url}")
        return "\n".join(lines)


# Global availability registry (set during pytest_sessionstart)
availability = ServiceAvailability()


# =============================================================================
# Pytest hooks
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "ci: mark as CI-only test")
    config.addinivalue_line("markers", "interactive: mark as interactive test")
    config.addinivalue_line("markers", "unit: mark as unit test")
    config.addinivalue_line("markers", "e2e: mark as end-to-end test")
    config.addinivalue_line("markers", "requires_litellm: mark as requiring LiteLLM service")
    config.addinivalue_line("markers", "requires_qdrant: mark as requiring Qdrant service")
    config.addinivalue_line("markers", "requires_mcp_memory: mark as requiring MCP Memory service")


def pytest_sessionstart(session):
    """Test service connectivity at session start."""
    print("\n" + "=" * 60)
    print("SMOKE TEST SESSION START — Checking service availability")
    print("=" * 60)

    # LiteLLM
    litellm_url = os.environ.get("LITELLM_URL", "http://localhost:4000")
    parsed = urlparse(litellm_url)
    litellm_reached = is_port_reachable(
        parsed.hostname or "localhost",
        parsed.port or 4000
    )
    availability.register("litellm", litellm_url, litellm_reached)

    # MCP Memory — try multiple ports
    mcp_memory_default = os.environ.get("MCP_MEMORY_URL", "http://localhost:4016")
    mcp_memory_url, mcp_memory_reached = discover_url(
        MCP_MEMORY_PORTS, mcp_memory_default, "mcp_memory"
    )
    availability.register("mcp_memory", mcp_memory_url, mcp_memory_reached)

    # Qdrant — try multiple hosts
    qdrant_default = os.environ.get("QDRANT_URL", "http://10.0.19.5:6333")
    qdrant_url, qdrant_reached = discover_qdrant_url(qdrant_default)
    availability.register("qdrant", qdrant_url, qdrant_reached)

    # Hermes
    hermes_url = os.environ.get("HERMES_URL", "http://localhost:4003")
    parsed = urlparse(hermes_url)
    hermes_reached = is_port_reachable(
        parsed.hostname or "localhost",
        parsed.port or 4003
    )
    availability.register("hermes", hermes_url, hermes_reached)

    print(availability.summary())
    print("=" * 60 + "\n")


def pytest_report_header(config):
    """Add service availability to pytest header."""
    lines = ["Service availability (session start):"]
    for name, reached in availability.services.items():
        status = "reachable" if reached else "UNAVAILABLE"
        url = availability.urls.get(name, "")
        lines.append(f"  {name}: {status} ({url})")
    return lines


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def litellm_url():
    return os.environ.get("LITELLM_URL", "http://localhost:4000")


@pytest.fixture(scope="session")
def litellm_key():
    return os.environ.get("LITELLM_KEY", "sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1")


@pytest.fixture(scope="session")
def mcp_memory_url():
    """Return the discovered MCP Memory URL (may differ from env default)."""
    return availability.get_url("mcp_memory")


@pytest.fixture(scope="session")
def mcp_memory_available():
    """Return whether MCP Memory is reachable."""
    return availability.is_available("mcp_memory")


@pytest.fixture(scope="session")
def qdrant_url():
    """Return the discovered Qdrant URL (may differ from env default)."""
    return availability.get_url("qdrant")


@pytest.fixture(scope="session")
def qdrant_key():
    return os.environ.get("QDRANT_API_KEY", "71cae77676e2a5fd552d172caa1c3200")


@pytest.fixture(scope="session")
def qdrant_available():
    """Return whether Qdrant is reachable."""
    return availability.is_available("qdrant")


@pytest.fixture(scope="session")
def hermes_url():
    return os.environ.get("HERMES_URL", "http://localhost:4003")


@pytest.fixture(scope="session")
def hermes_available():
    """Return whether Hermes is reachable."""
    return availability.is_available("hermes")


@pytest.fixture(scope="session")
def service_availability():
    """Expose the full availability registry to tests."""
    return availability


# =============================================================================
# Skip helpers for tests
# =============================================================================

def skip_if_litellm_unavailable():
    """Skip test if LiteLLM is not reachable."""
    if not availability.is_available("litellm"):
        pytest.skip("LiteLLM service is not reachable")


def skip_if_qdrant_unavailable():
    """Skip test if Qdrant is not reachable."""
    if not availability.is_available("qdrant"):
        pytest.skip("Qdrant service is not reachable")


def skip_if_mcp_memory_unavailable():
    """Skip test if MCP Memory is not reachable."""
    if not availability.is_available("mcp_memory"):
        pytest.skip("MCP Memory service is not reachable")


def skip_if_hermes_unavailable():
    """Skip test if Hermes is not reachable."""
    if not availability.is_available("hermes"):
        pytest.skip("Hermes service is not reachable")


# Expose skip helpers as module-level for tests to import
pytest.skip_if_litellm_unavailable = skip_if_litellm_unavailable
pytest.skip_if_qdrant_unavailable = skip_if_qdrant_unavailable
pytest.skip_if_mcp_memory_unavailable = skip_if_mcp_memory_unavailable
pytest.skip_if_hermes_unavailable = skip_if_hermes_unavailable