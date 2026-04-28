#!/usr/bin/env python3
"""Focused tests for Hermes-style hvac-copilot behavior."""

import importlib.util
import pathlib
import sys

import pytest


HVAC_RAG_PATH = pathlib.Path("/srv/monorepo/scripts/hvac-rag")
SPEC = importlib.util.spec_from_file_location(
    "hvac_rag_pipe_hermes_style",
    HVAC_RAG_PATH / "hvac-rag-pipe.py",
)
hvac_pipe = importlib.util.module_from_spec(SPEC)
sys.modules["hvac_rag_pipe_hermes_style"] = hvac_pipe
SPEC.loader.exec_module(hvac_pipe)


class FakeRequest:
    def __init__(self, conversation_id: str = "test-hermes-style") -> None:
        self.headers = {"x-conversation-id": conversation_id}


class FakeLiteLLMResponse:
    status_code = 502
    text = '{"error":{"type":"mock_upstream_unavailable"}}'

    def json(self):
        return {"error": {"type": "mock_upstream_unavailable"}}


class FakeAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        return FakeLiteLLMResponse()


@pytest.fixture(autouse=True)
def reset_state(monkeypatch):
    hvac_pipe.state_manager._state.clear()
    hvac_pipe.state_manager._last_access.clear()

    async def no_hits(*args, **kwargs):
        return []

    monkeypatch.setattr(hvac_pipe, "search_qdrant", no_hits)
    monkeypatch.setattr(hvac_pipe.httpx, "AsyncClient", FakeAsyncClient)


async def _send(content: str, conversation_id: str = "test-hermes-style"):
    body = hvac_pipe.ChatCompletionRequest(
        model="hvac-copilot",
        messages=[hvac_pipe.ChatMessage(role="user", content=content)],
    )
    result = await hvac_pipe.chat_completions(body, FakeRequest(conversation_id))
    return result["choices"][0]["message"]["content"]


async def _send_result(content: str, conversation_id: str = "test-hermes-style"):
    body = hvac_pipe.ChatCompletionRequest(
        model="hvac-copilot",
        messages=[hvac_pipe.ChatMessage(role="user", content=content)],
    )
    return await hvac_pipe.chat_completions(body, FakeRequest(conversation_id))


@pytest.mark.asyncio
async def test_multi_turn_uses_previous_model_and_alarm():
    conv = "test-u4-daikin"

    await _send("Alarme U4-001 Daikin VRV 4", conv)
    await _send("RXYQ20BRA + FXYC20BRA", conv)
    content = await _send("Quais são as causas mais comuns?", conv)

    lowered = content.lower()
    assert "u4" in lowered
    assert "comunicação" in lowered or "comunicacao" in lowered
    assert "modelo completo" not in lowered
    assert content.count("?") == 1


@pytest.mark.asyncio
async def test_e4_daikin_vrv_guided_triage_mentions_low_pressure_and_subcode():
    content = await _send("erro e4 vrv daikin", "test-e4")
    lowered = content.lower()

    assert "baixa pressão" in lowered or "baixa pressao" in lowered
    assert "e4-01" in lowered or "e4-001" in lowered
    assert "subcódigo" in lowered or "subcodigo" in lowered


@pytest.mark.asyncio
async def test_ipm_query_hits_safety_gate_without_energized_procedure():
    content = await _send("como testar IPM", "test-ipm")
    lowered = content.lower()

    assert "não vou orientar medição energizada" in lowered or "nao vou orientar medicao energizada" in lowered
    assert "manual" in lowered
    assert "modelo" in lowered


@pytest.mark.asyncio
async def test_refrigerator_query_blocked():
    content = await _send("geladeira frost free", "test-out-of-domain")
    lowered = content.lower()

    assert "bloquear" in lowered or "bloqueio" in lowered
    assert "fora do escopo" in lowered


@pytest.mark.asyncio
async def test_external_search_label_when_internal_manual_is_missing(monkeypatch):
    async def fake_external_search(*args, **kwargs):
        return (
            "[Fonte externa 1] Evidência: Fonte externa oficial | Origem: minimax_mcp\n"
            "Título: Daikin service manual\n"
            "URL: https://www.daikin.com/",
            "Fonte externa oficial",
            [{"evidence": "Fonte externa oficial", "title": "Daikin service manual", "url": "https://www.daikin.com/"}],
        )

    monkeypatch.setattr(hvac_pipe, "COPILOT_EXTERNAL_SEARCH_ENABLED", True)
    monkeypatch.setattr(hvac_pipe, "search_external_sources", fake_external_search)

    result = await _send_result("manual oficial Daikin VRV RXYQ20BRA U4", "test-web-fallback")
    content = result["choices"][0]["message"]["content"]

    assert "Evidência: Fonte externa oficial" in content
    assert result["evidence_labels"][0]["evidence"] == "Fonte externa oficial"


@pytest.mark.asyncio
async def test_models_endpoint_marks_copilot_default():
    result = await hvac_pipe.list_models()
    models = {item["id"]: item for item in result["data"]}

    assert {"hvac-copilot", "hvac-manual-strict", "hvac-field-tutor", "hvac-printable"} <= set(models)
    assert models["hvac-copilot"]["default"] is True
    assert models["hvac-copilot"]["preferred"] is True
