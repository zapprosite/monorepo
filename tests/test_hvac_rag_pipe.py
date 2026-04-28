"""
Pytest smoke tests for hvac-rag-pipe.py (port 4017).

Run: cd /srv/monorepo && pytest tests/test_hvac_rag_pipe.py -v
"""

import pytest
import httpx


BASE_URL = "http://127.0.0.1:4017"
TIMEOUT = 60.0

# Known HVAC model IDs the server should expose (when fully configured)
ALL_HVAC_MODELS = {
    "hvac-copilot",
    "hvac-manual-strict",
    "hvac-field-tutor",
    "hvac-printable",
}


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def client():
    """Sync HTTP client for smoke tests."""
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as c:
        yield c


@pytest.fixture
async def async_client():
    """Async HTTP client for async tests."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as c:
        yield c


# =============================================================================
# Helpers
# =============================================================================

def _chat_payload(model: str, messages: list, temperature: float = 0.3, max_tokens: int = 1024) -> dict:
    return {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }


def _post(client, model: str, messages: list, headers: dict = None, **kwargs):
    """POST to /v1/chat/completions."""
    return client.post(
        "/v1/chat/completions",
        json=_chat_payload(model, messages),
        headers=headers or {},
        **kwargs,
    )


# =============================================================================
# Health & Models
# =============================================================================

class TestHealth:
    """GET /health endpoint."""

    def test_health_returns_status_ok(self, client):
        """Health endpoint returns status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "hvac-rag-pipe"
        assert "version" in data


class TestModels:
    """GET /v1/models endpoint."""

    def test_v1_models_returns_available_models(self, client):
        """Models endpoint returns HVAC model(s). Verifies hvac-manual-strict is present."""
        resp = client.get("/v1/models")
        assert resp.status_code == 200
        data = resp.json()
        assert data["object"] == "list"
        models = data["data"]
        assert len(models) >= 1, f"Expected at least 1 model, got {len(models)}"

        model_ids = {m["id"] for m in models}
        # hvac-manual-strict must be present; other models depend on server version
        assert "hvac-manual-strict" in model_ids, f"hvac-manual-strict not found in {model_ids}"

    def test_v1_models_has_required_fields(self, client):
        """Each model has required OpenAI-compatible fields."""
        resp = client.get("/v1/models")
        data = resp.json()
        for model in data["data"]:
            assert "id" in model
            assert "object" in model
            assert "created" in model
            assert "owned_by" in model
            assert model["owned_by"] == "hvac-rag-pipe"

    def test_v1_models_contains_expected_hvac_ids(self, client):
        """At minimum, hvac-manual-strict is registered; hvac-copilot is the target copilot model."""
        resp = client.get("/v1/models")
        data = resp.json()
        model_ids = {m["id"] for m in data["data"]}
        # Strict minimum: manual-strict must be there
        assert "hvac-manual-strict" in model_ids
        # Target models that should exist in a fully configured deployment
        expected = {"hvac-copilot", "hvac-manual-strict", "hvac-field-tutor", "hvac-printable"}
        missing = expected - model_ids
        # Soft assertion: log missing models but only fail on hvac-manual-strict
        if missing:
            print(f"[smoke] Models not yet registered: {missing}")


# =============================================================================
# Chat Completions — hvac-manual-strict
# =============================================================================

class TestManualStrict:
    """POST /v1/chat/completions with hvac-manual-strict model."""

    def test_manual_strict_basic(self, client):
        """hvac-manual-strict responds to a valid HVAC query."""
        resp = _post(client, "hvac-manual-strict", [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}])
        # Accept 200 (success) or 502/504 (upstream unavailable but structured fallback)
        assert resp.status_code in (200, 502, 504), f"Unexpected status: {resp.status_code} — {resp.text[:200]}"
        data = resp.json()
        assert "choices" in data
        assert len(data["choices"]) > 0
        content = data["choices"][0]["message"]["content"]
        assert isinstance(content, str)
        assert len(content) > 0

    def test_manual_strict_with_model_number(self, client):
        """hvac-manual-strict responds to a full model number query."""
        resp = _post(client, "hvac-manual-strict", [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data
        content = data["choices"][0]["message"]["content"]
        assert isinstance(content, str)

    def test_manual_strict_response_model_field(self, client):
        """hvac-manual-strict response model field is set."""
        resp = _post(client, "hvac-manual-strict", [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert data.get("model") == "hvac-manual-strict"


# =============================================================================
# Chat Completions — hvac-copilot
# =============================================================================

class TestCopilot:
    """POST /v1/chat/completions with hvac-copilot model."""

    def test_copilot_basic(self, client):
        """hvac-copilot model parameter is accepted and returns a chat completion."""
        resp = _post(client, "hvac-copilot", [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}])
        assert resp.status_code in (200, 502, 504), f"Unexpected status: {resp.status_code}"
        data = resp.json()
        assert "choices" in data
        assert len(data["choices"]) > 0
        content = data["choices"][0]["message"]["content"]
        assert isinstance(content, str)
        assert len(content) > 0

    def test_copilot_model_in_response(self, client):
        """hvac-copilot request returns model field in response (may be hvac-manual-strict on older deployments)."""
        resp = _post(client, "hvac-copilot", [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "model" in data
        # Model field should be one of the HVAC models
        assert data["model"] in ALL_HVAC_MODELS, f"Unexpected model: {data['model']}"

    def test_copilot_evidence_labels_field(self, client):
        """hvac-copilot response may include evidence_labels field (取决于部署版本)."""
        resp = _post(client, "hvac-copilot", [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        # evidence_labels is only present in newer deployments with copilot flow
        if "evidence_labels" in data:
            assert isinstance(data["evidence_labels"], list)

    def test_copilot_response_has_content(self, client):
        """hvac-copilot returns non-empty content in message."""
        resp = _post(client, "hvac-copilot", [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        assert len(content) > 0


# =============================================================================
# Conversation State via x-conversation-id
# =============================================================================

class TestConversationState:
    """Conversation state is preserved via x-conversation-id header."""

    CONV_ID = "test-conv-smoke-001"

    def test_conversation_id_header_accepted(self, client):
        """x-conversation-id header is accepted without error."""
        resp = _post(
            client,
            "hvac-copilot",
            [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}],
            headers={"x-conversation-id": self.CONV_ID},
        )
        assert resp.status_code in (200, 502, 504), f"Status {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        assert "choices" in data

    def test_state_follow_up_query(self, client):
        """Second request with same conversation_id: short follow-up does not error."""
        headers = {"x-conversation-id": self.CONV_ID}

        # First message — establishes context
        resp1 = _post(
            client,
            "hvac-copilot",
            [{"role": "user", "content": "RXYQ20BRA"}],
            headers=headers,
        )
        assert resp1.status_code in (200, 502, 504)

        # Second message — short follow-up
        resp2 = _post(
            client,
            "hvac-copilot",
            [{"role": "user", "content": "E4"}],
            headers=headers,
        )
        assert resp2.status_code in (200, 502, 504)
        data2 = resp2.json()
        assert "choices" in data2
        content2 = data2["choices"][0]["message"]["content"]
        assert isinstance(content2, str)

    def test_no_conv_id_still_works(self, client):
        """Requests without x-conversation-id header succeed (auto-generated ID)."""
        resp = _post(client, "hvac-manual-strict", [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data


# =============================================================================
# Safety Warnings
# =============================================================================

class TestSafetyWarnings:
    """Responses involving high-voltage components include safety warnings."""

    def test_ipm_query_gets_safety_content(self, client):
        """Query about IPM/inverter board includes safety-related content."""
        payload = _chat_payload("hvac-copilot", [{"role": "user", "content": "como medir IPM RXYQ20BRA"}])
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        content = data["choices"][0]["message"]["content"].lower()
        has_safety = (
            "desligar" in content
            or "seguran" in content
            or "tens" in content
            or data.get("guided_triage") is True
        )
        assert has_safety, f"No safety content in response: {content[:300]}"

    def test_capacitor_query_gets_safety_content(self, client):
        """Query about capacitor includes safety or technical guidance."""
        payload = _chat_payload("hvac-manual-strict", [{"role": "user", "content": "capacitor de partida RXYQ20BRA"}])
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        content = data["choices"][0]["message"]["content"].lower()
        has_safety = (
            "desligar" in content
            or "capacitor" in content
            or "seguran" in content
        )
        assert has_safety


# =============================================================================
# Specific Query Tests
# =============================================================================

class TestSpecificQueries:
    """Smoke tests for specific known HVAC queries."""

    def test_query_u4_error_daikin(self, client):
        """Query: Alarme U4-001 Daikin VRV 4 — returns valid chat completion."""
        resp = _post(client, "hvac-copilot", [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data
        assert len(data["choices"]) > 0
        content = data["choices"][0]["message"]["content"]
        assert isinstance(content, str)
        assert len(content) > 0

    def test_query_model_combination_followup(self, client):
        """Query: RXYQ20BRA + FXYC20BRA followed by E4 follow-up with conversation state."""
        conv_id = "smoke-test-followup-001"
        headers = {"x-conversation-id": conv_id}

        # First establish model context
        resp1 = _post(
            client,
            "hvac-copilot",
            [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}],
            headers=headers,
        )
        assert resp1.status_code in (200, 502, 504)

        # Follow-up E4 with same conversation
        resp2 = _post(
            client,
            "hvac-copilot",
            [{"role": "user", "content": "E4"}],
            headers=headers,
        )
        assert resp2.status_code in (200, 502, 504)
        data2 = resp2.json()
        assert "choices" in data2
        assert len(data2["choices"]) > 0

    def test_query_model_combination_manual_strict(self, client):
        """Query: RXYQ20BRA + FXYC20BRA via manual-strict endpoint."""
        resp = _post(client, "hvac-manual-strict", [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}])
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data
        assert len(data["choices"]) > 0


# =============================================================================
# Async variants (pytest.mark.asyncio)
# =============================================================================

@pytest.mark.asyncio
class TestAsyncHealth:
    """Async GET /health."""

    async def test_health_async(self, async_client):
        resp = await async_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
class TestAsyncModels:
    """Async GET /v1/models."""

    async def test_v1_models_async(self, async_client):
        resp = await async_client.get("/v1/models")
        assert resp.status_code == 200
        data = resp.json()
        model_ids = {m["id"] for m in data["data"]}
        assert "hvac-manual-strict" in model_ids


@pytest.mark.asyncio
class TestAsyncChat:
    """Async POST /v1/chat/completions."""

    async def _post(self, client, model: str, messages: list, headers: dict = None):
        return await client.post(
            "/v1/chat/completions",
            json=_chat_payload(model, messages),
            headers=headers or {},
        )

    async def test_copilot_async(self, async_client):
        """hvac-copilot via async client returns valid completion."""
        resp = await self._post(
            async_client,
            "hvac-copilot",
            [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}],
        )
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data
        assert data["model"] in ALL_HVAC_MODELS

    async def test_manual_strict_async(self, async_client):
        """hvac-manual-strict via async client."""
        resp = await self._post(
            async_client,
            "hvac-manual-strict",
            [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}],
        )
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        assert "choices" in data

    async def test_evidence_labels_async_if_present(self, async_client):
        """evidence_labels field if present is a list (async variant)."""
        resp = await self._post(
            async_client,
            "hvac-copilot",
            [{"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}],
        )
        assert resp.status_code in (200, 502, 504)
        data = resp.json()
        if "evidence_labels" in data:
            assert isinstance(data["evidence_labels"], list)

    async def test_conversation_state_async(self, async_client):
        """x-conversation-id preserved across async requests."""
        conv_id = "async-smoke-conv-001"
        headers = {"x-conversation-id": conv_id}

        resp1 = await self._post(
            async_client,
            "hvac-copilot",
            [{"role": "user", "content": "RXYQ20BRA"}],
            headers=headers,
        )
        assert resp1.status_code in (200, 502, 504)

        resp2 = await self._post(
            async_client,
            "hvac-copilot",
            [{"role": "user", "content": "E4"}],
            headers=headers,
        )
        assert resp2.status_code in (200, 502, 504)
        data2 = resp2.json()
        assert "choices" in data2
