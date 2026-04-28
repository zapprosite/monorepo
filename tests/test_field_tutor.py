#!/usr/bin/env python3
"""
Pytest tests for hvac-field-tutor.py
Tests the field_tutor_query function and its enriched context generation.
"""

import sys
import re
import importlib.util
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# sys.path manipulation for imports
sys.path.insert(0, "/srv/monorepo/scripts")

# Load module directly from hyphenated filename
_spec = importlib.util.spec_from_file_location(
    "hvac_field_tutor",
    "/srv/monorepo/scripts/hvac-rag/hvac-field-tutor.py"
)
_hvac_field_tutor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hvac_field_tutor)

# Import functions from the loaded module
field_tutor_query = _hvac_field_tutor.field_tutor_query
build_field_tutor_context = _hvac_field_tutor.build_field_tutor_context
build_safety_procedure = _hvac_field_tutor.build_safety_procedure
build_error_code_flowchart = _hvac_field_tutor.build_error_code_flowchart
build_installation_checklist = _hvac_field_tutor.build_installation_checklist
build_standard_context = _hvac_field_tutor.build_standard_context
build_guided_triage_context = _hvac_field_tutor.build_guided_triage_context
is_safety_topic = _hvac_field_tutor.is_safety_topic
is_error_code_query = _hvac_field_tutor.is_error_code_query
is_installation_query = _hvac_field_tutor.is_installation_query
SAFETY_TOPICS = _hvac_field_tutor.SAFETY_TOPICS
ERROR_CODE_PATTERNS = _hvac_field_tutor.ERROR_CODE_PATTERNS


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_qdrant_hits():
    """Standard mock hits from Qdrant search."""
    return [
        {
            "id": 1,
            "score": 0.95,
            "payload": {
                "doc_type": "service_manual",
                "heading": "Error Code E4",
                "doc_id": "DAIKIN_VRV_2024",
                "model_candidates": ["VRV IV", "DAIKIN"],
                "error_code_candidates": ["E4", "E4-01"],
                "safety_tags": ["alta_tensao"],
                "text": "E4 indica baixa pressao no circuito. Verificar compressor e_valvulas."
            }
        },
        {
            "id": 2,
            "score": 0.89,
            "payload": {
                "doc_type": "safety_procedure",
                "heading": "Lockout/Tagout",
                "doc_id": "HVAC_SAFETY_001",
                "model_candidates": [],
                "error_code_candidates": [],
                "safety_tags": ["lockout_tagout", "alta_tensao", "capacitor"],
                "text": "Procedimento de bloqueio e identificacao para manutencao em alta tensao."
            }
        },
        {
            "id": 3,
            "score": 0.87,
            "payload": {
                "doc_type": "installation_guide",
                "heading": "Install Checklist",
                "doc_id": "INSTALL_DAIKIN_2024",
                "model_candidates": ["DAIKIN"],
                "error_code_candidates": [],
                "safety_tags": [],
                "text": "Checklist de instalacao: verificar local, suporte, conexoes eletricas."
            }
        },
    ]


@pytest.fixture
def mock_qdrant_hits_error_only():
    """Mock hits with error codes only (no safety/installation)."""
    return [
        {
            "id": 10,
            "score": 0.92,
            "payload": {
                "doc_type": "service_manual",
                "heading": "Error U4",
                "doc_id": "MITSUBISHI_PUMY",
                "model_candidates": ["PUHY", "PUMY"],
                "error_code_candidates": ["U4"],
                "safety_tags": [],
                "text": "U4 indica erro de comunicacao entre unidades internas e externa."
            }
        },
        {
            "id": 11,
            "score": 0.88,
            "payload": {
                "doc_type": "service_manual",
                "heading": "Error E4 Family",
                "doc_id": "DAIKIN_VRV_2024",
                "model_candidates": ["VRV IV"],
                "error_code_candidates": ["E4", "E4-02", "E4-03"],
                "safety_tags": [],
                "text": "E4-02 e E4-003 referem-se a variacoes por unidade slave."
            }
        },
    ]


@pytest.fixture
def mock_qdrant_hits_safety():
    """Mock hits with safety topics (capacitor, compressor)."""
    return [
        {
            "id": 20,
            "score": 0.91,
            "payload": {
                "doc_type": "safety_procedure",
                "heading": "Capacitor Safety",
                "doc_id": "HVAC_SAFETY_002",
                "model_candidates": [],
                "error_code_candidates": [],
                "safety_tags": ["capacitor", "alta_tensao", "descarrega"],
                "text": "Antes de tocar no capacitor, descargar completamente com resistor de 10k ohm."
            }
        },
        {
            "id": 21,
            "score": 0.86,
            "payload": {
                "doc_type": "safety_procedure",
                "heading": "Compressor Safety",
                "doc_id": "HVAC_SAFETY_003",
                "model_candidates": [],
                "error_code_candidates": [],
                "safety_tags": ["compressor", "alta_tensao"],
                "text": "Verificar pressoes e temperaturas antes de operar o compressor."
            }
        },
    ]


@pytest.fixture
def mock_qdrant_hits_installation():
    """Mock hits with installation content."""
    return [
        {
            "id": 30,
            "score": 0.93,
            "payload": {
                "doc_type": "installation_guide",
                "heading": "Pre-Installation",
                "doc_id": "INSTALL_CARRIER",
                "model_candidates": ["CARRIER"],
                "error_code_candidates": [],
                "safety_tags": [],
                "text": "Procedimento de instalacao: verificar local, suporte estrutural, espacso para manutencao. Install must follow manual."
            }
        },
        {
            "id": 31,
            "score": 0.85,
            "payload": {
                "doc_type": "installation_guide",
                "heading": "Mounting",
                "doc_id": "INSTALL_CARRIER_2",
                "model_candidates": ["CARRIER"],
                "error_code_candidates": [],
                "safety_tags": [],
                "text": "Montagem da unidade: usar parafusos adequados, nivelar unidade, conectar dreno. Instalação deve ser feita por profissional."
            }
        },
    ]


@pytest.fixture
def empty_hits():
    """Empty hits list."""
    return []


# =============================================================================
# Helper Functions
# =============================================================================

def create_mock_httpx_response(hits):
    """Create a mock httpx response for Qdrant search."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"result": hits}
    return mock_response


# =============================================================================
# Tests for field_tutor_query() returns context string
# =============================================================================

class TestFieldTutorQueryReturnsContext:
    """Test that field_tutor_query returns a context string."""

    @pytest.mark.asyncio
    async def test_field_tutor_query_returns_string(self, mock_qdrant_hits):
        """Test field_tutor_query returns a string."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits
            result = await field_tutor_query("test query")
            assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_field_tutor_query_returns_non_empty_string(self, mock_qdrant_hits):
        """Test field_tutor_query returns non-empty string when hits found."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits
            result = await field_tutor_query("test query")
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_empty_returns_message(self, empty_hits):
        """Test field_tutor_query returns message when no hits found."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = empty_hits
            result = await field_tutor_query("test query")
            assert "[Nenhum trecho encontrado" in result


# =============================================================================
# Tests for safety procedures (IPM, alta tensao)
# =============================================================================

class TestSafetyProcedures:
    """Test context includes safety procedures for IPM, alta tensao."""

    def test_is_safety_topic_ipm(self):
        """Test IPM is detected as safety topic."""
        assert is_safety_topic("IPM inverter board")

    def test_is_safety_topic_alta_tensao(self):
        """Test alta tensao (with proper accent) is detected as safety topic."""
        assert is_safety_topic("alta tensão procedure")

    def test_is_safety_topic_capacitor(self):
        """Test capacitor is detected as safety topic."""
        assert is_safety_topic("capacitor replacement")

    def test_is_safety_topic_compressor(self):
        """Test compressor is detected as safety topic."""
        assert is_safety_topic("compressor troubleshooting")

    def test_is_safety_topic_case_insensitive(self):
        """Test safety topic detection is case insensitive."""
        assert is_safety_topic("ALTA TENSÃO")
        assert is_safety_topic("Capacitor")

    def test_build_safety_procedure_contains_lockout(self, mock_qdrant_hits):
        """Test safety procedure includes lockout/tagout steps."""
        result = build_safety_procedure(mock_qdrant_hits)
        assert "DESLIGAR" in result or "lockout" in result.lower()

    def test_build_safety_procedure_contains_alta_tensao(self, mock_qdrant_hits):
        """Test safety procedure mentions alta tensao."""
        result = build_safety_procedure(mock_qdrant_hits)
        assert "TENSÃO" in result or "tensao" in result.lower()

    def test_build_safety_procedure_contains_epi(self, mock_qdrant_hits):
        """Test safety procedure includes EPI requirements."""
        result = build_safety_procedure(mock_qdrant_hits)
        assert "EPI" in result or "luvas" in result.lower() or "oculos" in result.lower()

    @pytest.mark.asyncio
    async def test_field_tutor_query_safety_injects_procedure(self, mock_qdrant_hits):
        """Test field_tutor_query injects safety procedure for safety topics."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits
            result = await field_tutor_query("alta tensao capacitor")
            # Should contain safety procedure section
            assert "TENSÃO" in result or "SEGURANÇA" in result


# =============================================================================
# Tests for error code flowcharts
# =============================================================================

class TestErrorCodeFlowcharts:
    """Test context includes error code flowcharts."""

    def test_is_error_code_query_e4(self):
        """Test E4 is detected as error code."""
        assert is_error_code_query("error E4 VRV")

    def test_is_error_code_query_u4(self):
        """Test U4 is detected as error code."""
        assert is_error_code_query("U4 communication error")

    def test_is_error_code_query_variations(self):
        """Test various error code formats are detected."""
        assert is_error_code_query("E4-01 error")
        assert is_error_code_query("A01 fault")
        assert is_error_code_query("F003 warning")
        assert is_error_code_query("P5 high pressure")

    def test_build_error_code_flowchart_returns_string(self, mock_qdrant_hits_error_only):
        """Test build_error_code_flowchart returns string."""
        result = build_error_code_flowchart(mock_qdrant_hits_error_only)
        assert isinstance(result, str)

    def test_build_error_code_flowchart_contains_error_codes(self, mock_qdrant_hits_error_only):
        """Test flowchart contains extracted error codes."""
        result = build_error_code_flowchart(mock_qdrant_hits_error_only)
        assert "E4" in result or "U4" in result

    def test_build_error_code_flowchart_empty_when_no_errors(self, mock_qdrant_hits_safety):
        """Test flowchart returns empty string when no error codes in hits."""
        result = build_error_code_flowchart(mock_qdrant_hits_safety)
        assert result == ""

    @pytest.mark.asyncio
    async def test_field_tutor_query_error_injects_flowchart(self, mock_qdrant_hits_error_only):
        """Test field_tutor_query injects flowchart for error code queries."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_error_only
            result = await field_tutor_query("error E4 U4 VRV")
            assert "FLUXO" in result or "DIAGNOSTICO" in result or "Erro" in result


# =============================================================================
# Tests for installation checklists
# =============================================================================

class TestInstallationChecklists:
    """Test context includes installation checklists."""

    def test_is_installation_query(self):
        """Test installation queries are detected."""
        assert is_installation_query("instalação do equipo")
        assert is_installation_query("install procedure")
        assert is_installation_query("montagem da unidade")

    def test_build_installation_checklist_returns_string(self, mock_qdrant_hits_installation):
        """Test build_installation_checklist returns string."""
        result = build_installation_checklist(mock_qdrant_hits_installation)
        assert isinstance(result, str)

    def test_build_installation_checklist_contains_checklist(self, mock_qdrant_hits_installation):
        """Test checklist contains checklist markers."""
        result = build_installation_checklist(mock_qdrant_hits_installation)
        assert "CHECKLIST" in result or "checklist" in result.lower()

    def test_build_installation_checklist_empty_when_no_install(self, mock_qdrant_hits_error_only):
        """Test checklist returns empty string when no installation content."""
        result = build_installation_checklist(mock_qdrant_hits_error_only)
        assert result == ""

    @pytest.mark.asyncio
    async def test_field_tutor_query_install_injects_checklist(self, mock_qdrant_hits_installation):
        """Test field_tutor_query injects checklist for installation queries."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_installation
            result = await field_tutor_query("instalação do ar condicionado")
            assert "CHECKLIST" in result or "INSTALA" in result


# =============================================================================
# Tests for error code queries (E4, U4)
# =============================================================================

class TestErrorCodeQueries:
    """Test queries with error codes (E4, U4)."""

    @pytest.mark.asyncio
    async def test_field_tutor_query_e4_error(self, mock_qdrant_hits_error_only):
        """Test field_tutor_query handles E4 error code."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_error_only
            result = await field_tutor_query("E4 error daikin vrv")
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_u4_error(self, mock_qdrant_hits_error_only):
        """Test field_tutor_query handles U4 error code."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_error_only
            result = await field_tutor_query("U4 error mistubishi pumy")
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_e4_and_u4(self, mock_qdrant_hits_error_only):
        """Test field_tutor_query handles both E4 and U4 in same query."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_error_only
            result = await field_tutor_query("E4 U4 error codes")
            assert isinstance(result, str)


# =============================================================================
# Tests for safety queries (capacitor, compressor)
# =============================================================================

class TestSafetyQueries:
    """Test queries about safety topics (capacitor, compressor)."""

    @pytest.mark.asyncio
    async def test_field_tutor_query_capacitor(self, mock_qdrant_hits_safety):
        """Test field_tutor_query handles capacitor safety query."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_safety
            result = await field_tutor_query("capacitor safety procedure")
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_compressor(self, mock_qdrant_hits_safety):
        """Test field_tutor_query handles compressor safety query."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_safety
            result = await field_tutor_query("compressor troubleshooting alta tensao")
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_capacitor_and_compressor(self, mock_qdrant_hits_safety):
        """Test field_tutor_query handles both capacitor and compressor."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_qdrant_hits_safety
            result = await field_tutor_query("capacitor compressor safety")
            assert isinstance(result, str)


# =============================================================================
# Tests for top_k parameter affects context length
# =============================================================================

class TestTopKParameter:
    """Test that top_k parameter affects context length."""

    def test_context_differs_with_different_hits_count(self, mock_qdrant_hits_error_only):
        """Test that context length differs based on number of hits."""
        hits_1 = mock_qdrant_hits_error_only[:1]
        hits_2 = mock_qdrant_hits_error_only

        ctx_1 = build_standard_context(hits_1, max_chars=7000)
        ctx_2 = build_standard_context(hits_2, max_chars=7000)

        assert len(ctx_1) != len(ctx_2) or ctx_1 != ctx_2

    def test_build_standard_context_respects_max_chars(self):
        """Test build_standard_context respects max_chars limit."""
        hits = [
            {
                "id": i,
                "score": 0.9,
                "payload": {
                    "doc_type": "service_manual",
                    "heading": f"Section {i}",
                    "doc_id": f"MANUAL_{i}",
                    "model_candidates": [],
                    "error_code_candidates": [],
                    "safety_tags": [],
                    "text": "A" * 500,
                }
            }
            for i in range(5)
        ]

        ctx_3000 = build_standard_context(hits, max_chars=3000)
        ctx_1000 = build_standard_context(hits, max_chars=1000)

        assert len(ctx_1000) < len(ctx_3000)

    def test_build_field_tutor_context_more_sections_with_more_hits(self, mock_qdrant_hits):
        """Test that more hits produce more sections in context."""
        few_hits = mock_qdrant_hits[:1]
        many_hits = mock_qdrant_hits

        ctx_few = build_field_tutor_context("test query", few_hits)
        ctx_many = build_field_tutor_context("test query", many_hits)

        # More hits should produce longer or different context
        assert len(ctx_many) >= len(ctx_few)


# =============================================================================
# Tests for guided triage mode
# =============================================================================

class TestGuidedTriage:
    """Test guided triage context building."""

    def test_build_guided_triage_context_contains_daikin_vrv(self):
        """Test guided triage context for Daikin VRV E4."""
        hits = [
            {
                "id": 1,
                "score": 0.95,
                "payload": {
                    "doc_type": "service_manual",
                    "heading": "E4 Error",
                    "doc_id": "DAIKIN_VRV",
                    "model_candidates": ["VRV"],
                    "error_code_candidates": ["E4"],
                    "safety_tags": [],
                    "text": "E4 error description for VRV."
                }
            }
        ]
        result = build_guided_triage_context("E4 daikin vrv", hits)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_build_guided_triage_context_with_empty_hits(self):
        """Test guided triage with no hits still returns message."""
        result = build_guided_triage_context("E4 unknown brand", [])
        assert "[Base de dados não encontrou" in result or "pista inicial" in result.lower()

    def test_build_guided_triage_context_extracts_subcode(self):
        """Test guided triage extracts E4 subcode correctly."""
        hits = []
        result = build_guided_triage_context("E4-01 daikin vrv", hits)
        assert "E4-01" in result or "E4-001" in result


# =============================================================================
# Tests for helper functions
# =============================================================================

class TestHelperFunctions:
    """Test helper functions used in field tutor."""

    def test_error_code_patterns(self):
        """Test error code regex pattern matches expected formats."""
        patterns = ["E4", "E401", "U4", "A01", "F003", "P5", "C10", "d5", "Y1", "J12", "E4-01", "E4012"]
        for pattern in patterns:
            assert ERROR_CODE_PATTERNS.search(pattern), f"Failed to match: {pattern}"

    def test_safety_topics_set_not_empty(self):
        """Test SAFETY_TOPICS contains expected topics."""
        assert "ipm" in SAFETY_TOPICS
        assert "alta tensão" in SAFETY_TOPICS
        assert "capacitor" in SAFETY_TOPICS
        assert "compressor" in SAFETY_TOPICS

    def test_build_standard_context_with_empty_hits(self):
        """Test build_standard_context with empty hits returns no results message."""
        result = build_standard_context([])
        assert "[Nenhum trecho encontrado" in result

    def test_build_standard_context_formats_chunks(self, mock_qdrant_hits):
        """Test build_standard_context properly formats chunks."""
        result = build_standard_context(mock_qdrant_hits)
        assert "Trecho 1" in result
        assert "Manual:" in result or "Tipo:" in result

    def test_build_field_tutor_context_combines_sections(self, mock_qdrant_hits):
        """Test build_field_tutor_context combines multiple sections."""
        result = build_field_tutor_context("capacitor alta tensao", mock_qdrant_hits)
        # Should have separators between sections
        assert "---" in result


# =============================================================================
# Integration-style tests (mocking Ollama embedding)
# =============================================================================

class TestWithMockedEmbedding:
    """Test field_tutor_query with mocked Ollama embedding."""

    @pytest.mark.asyncio
    async def test_field_tutor_query_with_mocked_embedding(self, mock_qdrant_hits):
        """Test field_tutor_query works when Ollama embedding is mocked."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search, \
             patch.object(_hvac_field_tutor, "get_embedding", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [0.1] * 768  # Mock embedding vector
            mock_search.return_value = mock_qdrant_hits

            result = await field_tutor_query("test query with mocked embedding")
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_field_tutor_query_when_embedding_fails(self):
        """Test field_tutor_query handles embedding failure gracefully."""
        with patch.object(_hvac_field_tutor, "search_qdrant", new_callable=AsyncMock) as mock_search, \
             patch.object(_hvac_field_tutor, "get_embedding", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = None  # Embedding fails
            mock_search.return_value = []

            result = await field_tutor_query("test query")
            assert "[Nenhum trecho encontrado" in result


# =============================================================================
# Run tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
