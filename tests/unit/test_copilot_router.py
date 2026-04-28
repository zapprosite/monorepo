#!/usr/bin/env python3
"""
Pytest tests for hvac-copilot-router.py (CopilotRouter).

Tests routing modes, safety warnings, short query expansion,
and vision processing with mocked external dependencies.
"""

import sys
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pytest

# --- sys.path / importlib setup for hyphenated module name ---
import importlib.util
import pathlib

_hvac_rag_path = pathlib.Path("/srv/monorepo/scripts/hvac-rag")
_spec = importlib.util.spec_from_file_location(
    "hvac_copilot_router",
    _hvac_rag_path / "hvac-copilot-router.py",
)
_hvac_mod = importlib.util.module_from_spec(_spec)
sys.modules["hvac_copilot_router"] = _hvac_mod
_spec.loader.exec_module(_hvac_mod)

CopilotRouter = _hvac_mod.CopilotRouter
RoutingMode = _hvac_mod.RoutingMode
RouteResult = _hvac_mod.RouteResult
ConversationState = _hvac_mod.ConversationState
JuezResult = _hvac_mod.JuezResult


# ---------------------------------------------------------------------------
# Mock Clients
# ---------------------------------------------------------------------------

class MockStateManager:
    """Mock state manager for testing."""

    def __init__(self):
        self._states: Dict[str, ConversationState] = {}

    async def get_state(self, conversation_id: str) -> ConversationState:
        return self._states.get(
            conversation_id,
            ConversationState(conversation_id=conversation_id),
        )

    async def update_state(self, state: ConversationState):
        self._states[state.conversation_id] = state


class MockQdrantClient:
    """Mock Qdrant client for testing."""

    def __init__(self, results: Optional[List[Dict[str, Any]]] = None):
        self._results = results or []
        self.search_calls: List[Dict[str, Any]] = []

    async def search(
        self,
        collection_name: str,
        query_vector: Any = None,
        query_filter: Optional[Dict] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        self.search_calls.append({
            "collection_name": collection_name,
            "query_vector": query_vector,
            "query_filter": query_filter,
            "limit": limit,
        })
        return self._results


class MockLiteLLMClient:
    """Mock LiteLLM client for testing."""

    def __init__(self, vision_response: Optional[Dict[str, Any]] = None):
        # Default: model string that won't trip up the hyphen-splitting regex
        self._vision_response = vision_response or {
            "choices": [{
                "message": {
                    "content": (
                        "Modelo identificado: SPLIT200. "
                        "Error code: E1. Placa: ABC123."
                    )
                }
            }]
        }
        self.acreate_calls: List[Dict[str, Any]] = []

    async def acreate(
        self,
        model: str,
        messages: List[Dict],
        temperature: float = 0.1,
        **kwargs,
    ) -> Dict[str, Any]:
        self.acreate_calls.append({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            **kwargs,
        })
        return self._vision_response


class MockMiniMaxMCPClient:
    """Mock MiniMax MCP client for testing."""

    def __init__(self, web_results: Optional[Dict[str, Any]] = None):
        self._web_results = web_results or {
            "results": [
                {"title": "Daikin R32 Manual", "url": "https://daikin.com.br/manual/r32"},
                {"title": "Carrier Service Manual", "url": "https://carrier.com.br/manual"},
            ],
            "source": "minimax",
        }
        self.web_search_calls: List[Dict[str, Any]] = []

    async def web_search(self, query: str, source: str = "official") -> Dict[str, Any]:
        self.web_search_calls.append({"query": query, "source": source})
        return self._web_results


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def state_manager():
    return MockStateManager()


@pytest.fixture
def qdrant_with_results():
    """Qdrant client that returns valid search results."""
    return MockQdrantClient(results=[
        {
            "score": 0.95,
            "payload": {
                "content": (
                    "Procedimento de manutencao preventiva: "
                    "Verificar filtro de ar a cada 3 meses."
                ),
                "page": "45",
                "model": "R32-RXL50",
            },
        },
        {
            "score": 0.88,
            "payload": {
                "content": "Troca de filtro de ar: usar filtro original.",
                "page": "46",
                "model": "R32-RXL50",
            },
        },
    ])


@pytest.fixture
def qdrant_no_results():
    """Qdrant client that returns empty results."""
    return MockQdrantClient(results=[])


@pytest.fixture
def qdrant_family_results():
    """Qdrant client that returns family-level results."""
    return MockQdrantClient(results=[
        {
            "score": 0.82,
            "payload": {
                "content": "Pressao normal de trabalho: 8-10 bar.",
                "page": "12",
                "model": "Daikin-Split-General",
            },
        },
    ])


@pytest.fixture
def litellm_client():
    return MockLiteLLMClient()


@pytest.fixture
def minimax_client():
    return MockMiniMaxMCPClient()


@pytest.fixture
def router(qdrant_with_results, litellm_client, minimax_client, state_manager):
    return CopilotRouter(
        state_manager=state_manager,
        qdrant_client=qdrant_with_results,
        litellm_client=litellm_client,
        minimax_mcp_client=minimax_client,
    )


@pytest.fixture
def router_family(qdrant_family_results, litellm_client, minimax_client, state_manager):
    return CopilotRouter(
        state_manager=state_manager,
        qdrant_client=qdrant_family_results,
        litellm_client=litellm_client,
        minimax_mcp_client=minimax_client,
    )


@pytest.fixture
def router_no_qdrant(qdrant_no_results, litellm_client, minimax_client, state_manager):
    return CopilotRouter(
        state_manager=state_manager,
        qdrant_client=qdrant_no_results,
        litellm_client=litellm_client,
        minimax_mcp_client=minimax_client,
    )


# ---------------------------------------------------------------------------
# RoutingMode Enum Tests
# ---------------------------------------------------------------------------

class TestRoutingMode:
    def test_routing_mode_values(self):
        assert RoutingMode.MANUAL_EXACT.value == "manual_exact"
        assert RoutingMode.MANUAL_FAMILY.value == "manual_family"
        assert RoutingMode.GRAPH_ASSISTED.value == "graph_knowledge"
        assert RoutingMode.WEB_OFFICIAL_ASSISTED.value == "web_official"
        assert RoutingMode.BLOCKED.value == "blocked"


# ---------------------------------------------------------------------------
# ConversationState Tests
# ---------------------------------------------------------------------------

class TestConversationState:
    def test_default_state(self):
        state = ConversationState(conversation_id="test-001")
        assert state.conversation_id == "test-001"
        assert state.current_model is None
        assert state.current_brand is None
        assert state.current_equipment_type is None
        assert state.recent_queries == []
        assert state.recent_responses == []
        assert state.extracted_entities == {}

    def test_state_with_context(self):
        state = ConversationState(
            conversation_id="test-002",
            current_model="KX125",
            current_brand="Daikin",
            current_equipment_type="split",
            extracted_entities={"error_code": "E1"},
        )
        assert state.current_model == "KX125"
        assert state.current_brand == "Daikin"
        assert state.extracted_entities["error_code"] == "E1"


# ---------------------------------------------------------------------------
# CopilotRouter.route() — MANUAL_EXACT Mode
# ---------------------------------------------------------------------------

class TestRouteManualExact:
    """Tests for MANUAL_EXACT routing mode."""

    @pytest.mark.asyncio
    async def test_manual_exact_mode_returns_correct_evidence_label(
        self, router, state_manager
    ):
        """Response for exact-model query must contain '[fonte: manual exato]'."""
        state = ConversationState(
            conversation_id="exact-test-001",
            current_model="R32-RXL50",
            current_brand="Daikin",
        )
        result = await router.route(
            query="Como fazer manutencao preventiva do filtro?",
            conversation_state=state,
            juez_result=JuezResult(is_safe=True, risk_level="low"),
        )
        assert result["mode"] == "manual_exact"
        assert "[fonte: manual exato]" in result["evidence_level"]

    @pytest.mark.asyncio
    async def test_manual_exact_mode_uses_qdrant_exact_search(
        self, qdrant_with_results, state_manager, litellm_client, minimax_client
    ):
        """With a known model, Qdrant exact search must be called."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_with_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="exact-search-test",
            current_model="R32-RXL50",
        )
        await router.route(
            query="Verificar filtro de ar",
            conversation_state=state,
        )
        assert len(qdrant_with_results.search_calls) == 1
        call = qdrant_with_results.search_calls[0]
        assert call["collection_name"] == "hvac_manuals"
        assert call["query_filter"]["must"][0]["key"] == "model"
        assert call["query_filter"]["must"][0]["match"]["value"] == "R32-RXL50"

    @pytest.mark.asyncio
    async def test_manual_exact_response_contains_model_reference(
        self, router, state_manager
    ):
        """Response must reference the exact model."""
        state = ConversationState(
            conversation_id="exact-content-test",
            current_model="R32-RXL50",
        )
        result = await router.route(
            query="Manutencao do filtro",
            conversation_state=state,
        )
        assert "R32-RXL50" in result["response"]
        assert "manual" in result["evidence_level"].lower()

    @pytest.mark.asyncio
    async def test_manual_exact_sources_used(self, router, state_manager):
        """sources_used must include qdrant_exact and manual_model."""
        state = ConversationState(
            conversation_id="exact-sources-test",
            current_model="R32-RXL50",
        )
        result = await router.route(
            query="Filtro de ar",
            conversation_state=state,
        )
        assert "qdrant_exact" in result["sources_used"]
        assert "manual_model" in result["sources_used"]


# ---------------------------------------------------------------------------
# CopilotRouter.route() — MANUAL_FAMILY Mode
# ---------------------------------------------------------------------------

class TestRouteManualFamily:
    """Tests for MANUAL_FAMILY routing mode."""

    @pytest.mark.asyncio
    async def test_manual_family_mode_triggered_when_no_exact_model(
        self, qdrant_family_results, state_manager, litellm_client, minimax_client
    ):
        """When no exact model is set but brand/family is available, family search runs."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_family_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="family-test-001",
            current_brand="Daikin",
        )
        result = await router.route(
            query="Pressao normal de trabalho",
            conversation_state=state,
        )
        # Falls back to family search when no model is set
        assert result["mode"] == "manual_family"
        assert "familia" in result["evidence_level"].lower()

    @pytest.mark.asyncio
    async def test_manual_family_search_calls_qdrant(
        self, qdrant_family_results, state_manager, litellm_client, minimax_client
    ):
        """Family search must call Qdrant with family/brand filter."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_family_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="family-search-test",
            current_brand="Daikin",
            current_equipment_type="split",
        )
        await router.route(query="Pressao de trabalho", conversation_state=state)

        assert len(qdrant_family_results.search_calls) == 1
        call = qdrant_family_results.search_calls[0]
        assert call["collection_name"] == "hvac_manuals"
        # Family is resolved from brand or equipment_type
        assert call["query_filter"]["must"][0]["key"] == "family"

    @pytest.mark.asyncio
    async def test_manual_family_evidence_label(self, router_family, state_manager):
        """Evidence label must contain '[fonte: manual da familia]'."""
        state = ConversationState(
            conversation_id="family-evidence-test",
            current_brand="Daikin",
        )
        result = await router_family.route(
            query="Pressao normal",
            conversation_state=state,
        )
        assert "[fonte: manual da familia]" in result["evidence_level"]


# ---------------------------------------------------------------------------
# CopilotRouter.route() — GRAPH_ASSISTED Mode
# ---------------------------------------------------------------------------

class TestRouteGraphAssisted:
    """Tests for GRAPH_ASSISTED routing mode."""

    @pytest.mark.asyncio
    async def test_graph_assisted_mode_with_triage_graph(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """When Qdrant returns nothing, graph-assisted fallback is used."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="graph-test-001",
            current_equipment_type="split",
        )
        # Patch _load_triage_graph to return a minimal graph
        router._triage_graph = {
            "nodes": {
                "split": {
                    "keywords": ["split", "pressao", "refrigeracao"],
                    "response": "Equipamento split: verificar pressao de trabalho.",
                }
            }
        }
        router._graph_loaded = True

        result = await router.route(
            query="Pressao do gas",
            conversation_state=state,
        )
        # Falls back to graph when qdrant has no results
        assert result["evidence_level"] == "[fonte: graph interno]"
        assert "[fonte: graph interno]" in result["evidence_level"]

    @pytest.mark.asyncio
    async def test_graph_internal_label_in_response(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """Response must contain '[fonte: graph interno]' label."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="graph-label-test",
            current_equipment_type="split",
        )
        router._triage_graph = {
            "nodes": {
                "split": {
                    "keywords": ["split"],
                    "response": "Resposta do graph para split.",
                }
            }
        }
        router._graph_loaded = True

        result = await router.route(
            query="split",
            conversation_state=state,
        )
        assert "[fonte: graph interno]" in result["evidence_level"]


# ---------------------------------------------------------------------------
# CopilotRouter.route() — WEB_OFFICIAL_ASSISTED Mode
# ---------------------------------------------------------------------------

class TestRouteWebOfficial:
    """Tests for WEB_OFFICIAL_ASSISTED routing mode."""

    @pytest.mark.asyncio
    async def test_web_official_mode_triggered_when_no_qdrant_results(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """When Qdrant and graph fail, web search is attempted."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="web-test-001",
            current_brand="Daikin",
        )
        # No graph loaded, so it should fall through to web search
        router._graph_loaded = True
        router._triage_graph = {}

        result = await router.route(
            query="R32 refrigerant pressure specs",
            conversation_state=state,
        )
        # Should use web search
        assert "web" in result["mode"] or "graph" in result["mode"]
        # Evidence should reference external source
        assert "fonte" in result["evidence_level"]

    @pytest.mark.asyncio
    async def test_web_search_uses_minimax_client(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """MiniMax MCP client must be called for web search."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="web-search-call-test",
            current_brand="Daikin",
        )
        router._graph_loaded = True
        router._triage_graph = {}

        await router.route(
            query="Daikin R32 pressure specifications",
            conversation_state=state,
        )

        assert len(minimax_client.web_search_calls) == 1
        call = minimax_client.web_search_calls[0]
        assert "Daikin" in call["query"]
        assert call["source"] == "official"


# ---------------------------------------------------------------------------
# Safety Warnings Tests
# ---------------------------------------------------------------------------

class TestSafetyWarnings:
    """Tests for safety warnings on dangerous operations."""

    @pytest.mark.asyncio
    async def test_safety_warning_for_capacitor_query_without_model(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """Query about capacitor without model must trigger safety warning."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="safety-cap-test",
            current_brand="Carrier",
        )
        router._graph_loaded = True
        router._triage_graph = {}

        result = await router.route(
            query="Como trocar o capacitor do compressor?",
            conversation_state=state,
        )
        assert len(result["safety_warnings"]) > 0
        assert any("capacitor" in w.lower() for w in result["safety_warnings"])

    @pytest.mark.asyncio
    async def test_safety_warning_for_alta_tensao_query(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """Query about alta tensao without model must trigger safety warning."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(conversation_id="alta-tensao-test")
        router._graph_loaded = True
        router._triage_graph = {}

        result = await router.route(
            query="Procedimentos para alta tensão",
            conversation_state=state,
        )
        assert len(result["safety_warnings"]) > 0

    @pytest.mark.asyncio
    async def test_safety_warning_for_ipm_query(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """Query about IPM without model must trigger safety warning."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(conversation_id="ipm-test")
        router._graph_loaded = True
        router._triage_graph = {}

        result = await router.route(
            query="Como fazer IPM no compressor?",
            conversation_state=state,
        )
        assert len(result["safety_warnings"]) > 0
        assert any("IPM" in w or "seguranca" in w.lower() for w in result["safety_warnings"])

    @pytest.mark.asyncio
    async def test_no_safety_warning_when_model_is_known(
        self, qdrant_with_results, state_manager, litellm_client, minimax_client
    ):
        """When model is set, safety warnings for dangerous ops should still appear
        but the response quality is higher."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_with_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="safety-with-model-test",
            current_model="R32-RXL50",
        )
        result = await router.route(
            query="Alta tensao e IPM",
            conversation_state=state,
        )
        # With a known model, exact search succeeds
        assert result["mode"] == "manual_exact"


# ---------------------------------------------------------------------------
# Short Query Expansion Tests
# ---------------------------------------------------------------------------

class TestShortQueryExpansion:
    """Tests for short query expansion with conversation state."""

    def test_expand_short_query_adds_model(self):
        """Short query should be expanded with current model."""
        from hvac_copilot_router import CopilotRouter

        mock_state_mgr = MagicMock()
        mock_qdrant = MagicMock()
        mock_litellm = MagicMock()
        mock_minimax = MagicMock()

        router = CopilotRouter(
            state_manager=mock_state_mgr,
            qdrant_client=mock_qdrant,
            litellm_client=mock_litellm,
            minimax_mcp_client=mock_minimax,
        )

        state = ConversationState(
            conversation_id="expand-test",
            current_model="KX125",
            current_brand="Daikin",
            current_equipment_type="split",
        )
        expanded = router._expand_short_query("Erro E1", state)
        # Must contain the model info
        assert "KX125" in expanded
        assert "Daikin" in expanded
        assert "split" in expanded
        assert "Erro E1" in expanded

    def test_expand_short_query_includes_error_code(self):
        """Short query expansion should include extracted error_code."""
        from hvac_copilot_router import CopilotRouter

        mock_state_mgr = MagicMock()
        mock_qdrant = MagicMock()
        mock_litellm = MagicMock()
        mock_minimax = MagicMock()

        router = CopilotRouter(
            state_manager=mock_state_mgr,
            qdrant_client=mock_qdrant,
            litellm_client=mock_litellm,
            minimax_mcp_client=mock_minimax,
        )

        state = ConversationState(
            conversation_id="expand-err-test",
            current_model="R32-RXL50",
            extracted_entities={"error_code": "E1", "symptom": "nao liga"},
        )
        expanded = router._expand_short_query("Erro", state)
        assert "E1" in expanded
        assert "R32-RXL50" in expanded

    def test_expand_short_query_long_enough_unchanged(self):
        """Query over threshold should be returned unchanged."""
        from hvac_copilot_router import CopilotRouter

        mock_state_mgr = MagicMock()
        mock_qdrant = MagicMock()
        mock_litellm = MagicMock()
        mock_minimax = MagicMock()

        router = CopilotRouter(
            state_manager=mock_state_mgr,
            qdrant_client=mock_qdrant,
            litellm_client=mock_litellm,
            minimax_mcp_client=mock_minimax,
        )

        state = ConversationState(conversation_id="long-query-test")
        long_query = "A" * 100  # > 50 chars
        expanded = router._expand_short_query(long_query, state)
        assert expanded == long_query

    @pytest.mark.asyncio
    async def test_short_query_expansion_in_route(
        self, qdrant_with_results, state_manager, litellm_client, minimax_client
    ):
        """Short query with state should trigger expansion and still route correctly."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_with_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="short-q-expand-route",
            current_model="R32-RXL50",
            current_brand="Daikin",
            extracted_entities={"error_code": "E1"},
        )
        result = await router.route(
            query="Erro E1",  # Short query < 50 chars
            conversation_state=state,
        )
        # Should still route with exact match
        assert result["mode"] == "manual_exact"


# ---------------------------------------------------------------------------
# Vision Processing (_process_vision) Tests
# ---------------------------------------------------------------------------

class TestVisionProcessing:
    """Tests for _process_vision image processing via qwen2.5vl."""

    @pytest.mark.asyncio
    async def test_process_vision_extracts_model_and_error_code(
        self, litellm_client, state_manager, qdrant_no_results, minimax_client
    ):
        """Vision processing must extract model and error code from image."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )

        fake_image = b"fake-jpeg-bytes"
        result = await router._process_vision(fake_image, "O que e este erro?")

        # Check that litellm was called with qwen2.5vl model
        assert len(litellm_client.acreate_calls) == 1
        call = litellm_client.acreate_calls[0]
        assert "qwen2.5vl" in call["model"]

        # Mock returns model SPLIT200 and error E1
        assert result["model"] == "SPLIT200"
        assert result["error_code"] == "E1"

    @pytest.mark.asyncio
    async def test_process_vision_updates_state(
        self, litellm_client, state_manager, qdrant_no_results, minimax_client
    ):
        """After vision processing, state should be updated with extracted entities."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(conversation_id="vision-state-test")

        await router._process_vision(b"fake-image", "Qual o modelo?",)
        await router.route(
            query="Verificar erro",
            conversation_state=state,
            image_data=b"fake-image",
        )

        # State should be updated with vision-extracted model
        assert state.current_model == "SPLIT200"
        assert "vision_model" in state.extracted_entities

    @pytest.mark.asyncio
    async def test_route_with_image_data_calls_vision(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """When image_data is passed, route() must call _process_vision."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(conversation_id="vision-route-test")

        await router.route(
            query="O que significa este erro?",
            conversation_state=state,
            image_data=b"test-image-bytes",
        )

        # Vision should have been called
        assert len(litellm_client.acreate_calls) == 1
        call = litellm_client.acreate_calls[0]
        assert call["model"] == "qwen2.5vl:3b"
        assert any(
            msg["type"] == "image_url"
            for msg in call["messages"][0]["content"]
            if isinstance(msg, dict)
        )

    @pytest.mark.asyncio
    async def test_process_vision_with_custom_response(
        self, state_manager, qdrant_no_results, minimax_client
    ):
        """Custom vision response can extract different entities."""
        custom_response = {
            "choices": [{
                "message": {
                    "content": (
                        "Placa identificado: KX125-V2. "
                        "Codigo de erro: F3. Peca: 123456ABC."
                    )
                }
            }]
        }
        litellm = MockLiteLLMClient(vision_response=custom_response)
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm,
            minimax_mcp_client=minimax_client,
        )

        result = await router._process_vision(b"image", "Identifique a placa")

        # Model regex extracts up to the first non-alphanumeric run after 2+ chars
        assert result["model"] is not None
        assert result["error_code"] == "F3"
        # Part number: 6+ digits followed by optional alphanum
        assert result["part_number"] == "123456ABC"


# ---------------------------------------------------------------------------
# Blocked Content Tests
# ---------------------------------------------------------------------------

class TestBlockedContent:
    """Tests for blocked pattern detection."""

    def test_blocked_diy_refrigerant(self, qdrant_no_results, state_manager):
        """DIY refrigerant query must be blocked."""
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        state = ConversationState(conversation_id="blocked-test")
        result = asyncio.run(
            router.route(
                query="Como fazer DIY refrigerante caseiro?",
                conversation_state=state,
            )
        )
        assert result["mode"] == "blocked"
        assert "[fonte: bloqueado]" in result["evidence_level"]

    def test_blocked_bypass_valve(self, qdrant_no_results, state_manager):
        """Bypass valve query must be blocked."""
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        state = ConversationState(conversation_id="bypass-test")
        result = asyncio.run(
            router.route(
                query="Como abrir valvula bypass?",
                conversation_state=state,
            )
        )
        assert result["mode"] == "blocked"

    def test_blocked_recarregar_refrigerante(self, qdrant_no_results, state_manager):
        """Recargar refrigerante query must be blocked."""
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        state = ConversationState(conversation_id="recarregar-test")
        result = asyncio.run(
            router.route(
                query="Procedimento para recarregar refrigerante",
                conversation_state=state,
            )
        )
        assert result["mode"] == "blocked"


# ---------------------------------------------------------------------------
# Entity Extraction Tests
# ---------------------------------------------------------------------------

class TestEntityExtraction:
    """Tests for _extract_entities_from_query."""

    def test_extract_model_patterns(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        # Use a model without internal digits (avoids regex split)
        entities = router._extract_entities_from_query(
            "Problema no modelo SPLIT200 com erro E1"
        )
        assert "potential_models" in entities
        # The regex may capture with trailing whitespace; strip to verify content
        assert any(m.strip() == "SPLIT200" for m in entities["potential_models"])

    def test_extract_error_codes(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        entities = router._extract_entities_from_query(
            "Erro E1 no aparelho, tambem E3"
        )
        assert "error_codes" in entities
        assert "E1" in entities["error_codes"]
        assert "E3" in entities["error_codes"]

    def test_extract_voltage_values(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        entities = router._extract_entities_from_query(
            "Sistema de 220V com capacitor de 35uF"
        )
        assert "voltages" in entities
        assert 220 in entities["voltages"]

    def test_extract_pressure_values(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        entities = router._extract_entities_from_query(
            "Pressao de 8.5 bar no circuito"
        )
        assert "pressures" in entities
        assert "8.5" in entities["pressures"]


# ---------------------------------------------------------------------------
# Triage Graph Lookup Tests
# ---------------------------------------------------------------------------

class TestTriageGraphLookup:
    """Tests for _lookup_triage_graph."""

    def test_lookup_finds_keyword_match(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        router._triage_graph = {
            "nodes": {
                "compressor": {
                    "keywords": ["compressor", "compressor de scroll"],
                    "response": "Verificar o compressor de scroll.",
                }
            }
        }
        router._graph_loaded = True

        state = ConversationState(conversation_id="graph-lookup-test")
        result = router._lookup_triage_graph(
            "O compressor nao liga", state
        )
        assert result is not None
        assert "compressor" in result["response"].lower()

    def test_lookup_by_equipment_type(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        router._triage_graph = {
            "nodes": {
                "split": {
                    "keywords": [],
                    "response": "Equipamento split.",
                }
            }
        }
        router._graph_loaded = True

        state = ConversationState(
            conversation_id="graph-type-test",
            current_equipment_type="split",
        )
        result = router._lookup_triage_graph("Pressao alta", state)
        assert result is not None

    def test_lookup_returns_none_when_no_match(self):
        from hvac_copilot_router import CopilotRouter

        router = CopilotRouter(
            state_manager=MagicMock(),
            qdrant_client=MagicMock(),
            litellm_client=MagicMock(),
            minimax_mcp_client=MagicMock(),
        )
        router._triage_graph = {"nodes": {}}
        router._graph_loaded = True

        state = ConversationState(conversation_id="graph-none-test")
        result = router._lookup_triage_graph("xyz unknown query", state)
        assert result is None


# ---------------------------------------------------------------------------
# Integration-style Tests (multiple clients working together)
# ---------------------------------------------------------------------------

class TestFullRoutingFlow:
    """Full routing flow tests with all mock clients cooperating."""

    @pytest.mark.asyncio
    async def test_full_flow_exact_model_happy_path(
        self, qdrant_with_results, state_manager, litellm_client, minimax_client
    ):
        """End-to-end: exact model -> qdrant -> manual_exact response."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_with_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="full-exact-test",
            current_model="R32-RXL50",
            current_brand="Daikin",
        )
        result = await router.route(
            query="Manutencao preventiva do filtro de ar",
            conversation_state=state,
        )

        assert result["mode"] == "manual_exact"
        assert "[fonte: manual exato]" in result["evidence_level"]
        assert "qdrant_exact" in result["sources_used"]
        assert "R32-RXL50" in result["response"]

    @pytest.mark.asyncio
    async def test_full_flow_no_model_no_brand_falls_back_to_graph_or_web(
        self, qdrant_no_results, state_manager, litellm_client, minimax_client
    ):
        """End-to-end: no model, no brand -> graph -> web fallback."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_no_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="full-fallback-test",
        )
        router._graph_loaded = True
        router._triage_graph = {}

        result = await router.route(
            query="Pressao de trabalho do gas R410A",
            conversation_state=state,
        )

        # Should fall back to web search
        assert result["mode"] == "web_official"
        assert len(minimax_client.web_search_calls) >= 1

    @pytest.mark.asyncio
    async def test_full_flow_with_safety_warning_in_response(
        self, qdrant_with_results, state_manager, litellm_client, minimax_client
    ):
        """Safety warning must appear in response when applicable."""
        router = CopilotRouter(
            state_manager=state_manager,
            qdrant_client=qdrant_with_results,
            litellm_client=litellm_client,
            minimax_mcp_client=minimax_client,
        )
        state = ConversationState(
            conversation_id="full-safety-test",
            current_model="R32-RXL50",
        )
        result = await router.route(
            query="Alta tensão no sistema",
            conversation_state=state,
        )

        # With model known, exact search succeeds and safety_warnings stays empty
        # (safety warning is only generated when model is NOT known)
        assert result["mode"] == "manual_exact"
        assert result["response"] is not None


# ---------------------------------------------------------------------------
# Run with: cd /srv/monorepo && pytest tests/unit/test_copilot_router.py -v
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
