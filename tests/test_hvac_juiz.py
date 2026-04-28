#!/usr/bin/env python3
"""
Pytest unit tests for hvac-juiz.py.
Tests all JuizResult modes, evidence levels, allowed_sources, flags, and confidence scores.
"""

import sys
import importlib.util

# Load the module from the hyphenated filename
spec = importlib.util.spec_from_file_location(
    "hvac_juiz",
    "/srv/monorepo/scripts/hvac-rag/hvac-juiz.py"
)
hvac_juiz = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hvac_juiz)

# Import everything from the loaded module
judge = hvac_juiz.judge
JuizResult = hvac_juiz.JuizResult
EvidenceLevel = hvac_juiz.EvidenceLevel
has_hvac_components = hvac_juiz.has_hvac_components
has_error_codes = hvac_juiz.has_error_codes
has_model_patterns = hvac_juiz.has_model_patterns
has_complete_model = hvac_juiz.has_complete_model
is_out_of_domain = hvac_juiz.is_out_of_domain
has_safety_keywords = hvac_juiz.has_safety_keywords
has_field_tutor_keywords = hvac_juiz.has_field_tutor_keywords
has_printable_keywords = hvac_juiz.has_printable_keywords
has_web_official_keywords = hvac_juiz.has_web_official_keywords
has_manual_keywords = hvac_juiz.has_manual_keywords
has_graph_assisted_keywords = hvac_juiz.has_graph_assisted_keywords
is_guided_triage_candidate = hvac_juiz.is_guided_triage_candidate
needs_clarification = hvac_juiz.needs_clarification
get_allowed_sources = hvac_juiz.get_allowed_sources

import pytest


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def all_modes():
    """Return all JuizResult modes."""
    return list(JuizResult)


# =============================================================================
# Test JuizResult Enum - All 10 Modes
# =============================================================================

class TestJuizResultModes:
    """Test all 10 JuizResult modes."""

    @pytest.mark.parametrize("mode", [
        JuizResult.APPROVED,
        JuizResult.BLOCKED,
        JuizResult.ASK_CLARIFICATION,
        JuizResult.ASK_ONE_SIMPLE_QUESTION,
        JuizResult.GUIDED_TRIAGE,
        JuizResult.MANUAL_EXACT,
        JuizResult.MANUAL_FAMILY,
        JuizResult.GRAPH_ASSISTED,
        JuizResult.WEB_OFFICIAL_ASSISTED,
        JuizResult.FIELD_TUTOR,
        JuizResult.PRINTABLE,
    ])
    def test_mode_exists(self, mode):
        """Test each mode exists and has a value."""
        assert mode.value is not None
        assert isinstance(mode.value, str)

    @pytest.mark.parametrize("mode,expected_value", [
        (JuizResult.APPROVED, "APPROVED"),
        (JuizResult.BLOCKED, "BLOCKED"),
        (JuizResult.ASK_CLARIFICATION, "ASK_CLARIFICATION"),
        (JuizResult.ASK_ONE_SIMPLE_QUESTION, "ASK_ONE_SIMPLE_QUESTION"),
        (JuizResult.GUIDED_TRIAGE, "GUIDED_TRIAGE"),
        (JuizResult.MANUAL_EXACT, "MANUAL_EXACT"),
        (JuizResult.MANUAL_FAMILY, "MANUAL_FAMILY"),
        (JuizResult.GRAPH_ASSISTED, "GRAPH_ASSISTED"),
        (JuizResult.WEB_OFFICIAL_ASSISTED, "WEB_OFFICIAL_ASSISTED"),
        (JuizResult.FIELD_TUTOR, "FIELD_TUTOR"),
        (JuizResult.PRINTABLE, "PRINTABLE"),
    ])
    def test_mode_values(self, mode, expected_value):
        """Test each mode has correct string value."""
        assert mode.value == expected_value


# =============================================================================
# Test EvidenceLevel Enum
# =============================================================================

class TestEvidenceLevel:
    """Test EvidenceLevel enum values."""

    @pytest.mark.parametrize("level", [
        EvidenceLevel.MANUAL_EXACT,
        EvidenceLevel.MANUAL_FAMILY,
        EvidenceLevel.GRAPH_KNOWLEDGE,
        EvidenceLevel.WEB_OFFICIAL,
        EvidenceLevel.UNKNOWN,
    ])
    def test_evidence_level_exists(self, level):
        """Test each evidence level exists and has a value."""
        assert level.value is not None
        assert isinstance(level.value, str)

    @pytest.mark.parametrize("level,expected_value", [
        (EvidenceLevel.MANUAL_EXACT, "manual_exact"),
        (EvidenceLevel.MANUAL_FAMILY, "manual_family"),
        (EvidenceLevel.GRAPH_KNOWLEDGE, "graph_knowledge"),
        (EvidenceLevel.WEB_OFFICIAL, "web_official"),
        (EvidenceLevel.UNKNOWN, "unknown"),
    ])
    def test_evidence_level_values(self, level, expected_value):
        """Test each evidence level has correct string value."""
        assert level.value == expected_value


# =============================================================================
# Test APPROVED Mode
# =============================================================================

class TestApprovedMode:
    """Test APPROVED mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("RXYQ20BR erro U4 comunicação", "valid HVAC with error code"),
        ("VRV RXYQ10BRA código E3 alta pressão", "VRV with full model - approved"),
        ("RXYQ20BRA IPM alta tensão", "IPM safety query WITH model - APPROVED"),
        ("RXYQ20BRA ponte de diodos", "diode bridge WITH model - APPROVED"),
        ("como funciona um split inverter", "generic inverter question"),
    ])
    def test_approved_mode(self, query, description):
        """Test queries that should return APPROVED."""
        result, metadata = judge(query)
        assert result == JuizResult.APPROVED, f"Expected APPROVED for: {description}"
        assert metadata["result"] == JuizResult.APPROVED.value
        assert metadata["mode"] == JuizResult.APPROVED.value
        assert metadata["reason"] is not None

    def test_approved_confidence_range(self):
        """Test APPROVED confidence is within valid range."""
        result, metadata = judge("RXYQ20BR erro U4 comunicação")
        assert 0.0 <= metadata["confidence"] <= 1.0

    def test_approved_allowed_sources(self):
        """Test APPROVED allowed sources."""
        result, metadata = judge("RXYQ20BR erro U4 comunicação")
        assert "vector" in metadata["allowed_sources"]
        assert isinstance(metadata["allowed_sources"], list)

    def test_approved_with_error_codes_has_error_db(self):
        """Test APPROVED with error codes includes error_code_db source."""
        result, metadata = judge("RXYQ20BR erro U4 comunicação")
        if "error_code_db" in metadata["allowed_sources"]:
            assert "error_code_db" in metadata["allowed_sources"]

    def test_approved_evidence_level(self):
        """Test APPROVED evidence level is UNKNOWN."""
        result, metadata = judge("RXYQ20BR erro U4 comunicação")
        assert metadata["evidence_level"] == EvidenceLevel.UNKNOWN.value


# =============================================================================
# Test BLOCKED Mode
# =============================================================================

class TestBlockedMode:
    """Test BLOCKED mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("geladeira frost free", "refrigerator - blocked"),
        ("manual de TV", "TV manual - blocked"),
        ("televisão Samsung 55 polegadas", "TV - blocked"),
        ("receita de bolo de chocolate", "recipe - blocked"),
        ("máquina de lavar Electrolux", "washing machine - blocked"),
        ("test", "generic test - blocked"),
        ("asdf qwerty", "random chars - blocked"),
    ])
    def test_blocked_mode(self, query, description):
        """Test queries that should return BLOCKED."""
        result, metadata = judge(query)
        assert result == JuizResult.BLOCKED, f"Expected BLOCKED for: {description}"
        assert metadata["result"] == JuizResult.BLOCKED.value
        assert metadata["is_out_of_domain"] is True

    def test_blocked_confidence_is_one(self):
        """Test BLOCKED confidence is 1.0."""
        result, metadata = judge("geladeira frost free")
        assert metadata["confidence"] == 1.0

    def test_blocked_allowed_sources_empty(self):
        """Test BLOCKED has no allowed sources."""
        result, metadata = judge("geladeira frost free")
        assert metadata["allowed_sources"] == []

    def test_blocked_reason(self):
        """Test BLOCKED reason is out_of_domain."""
        result, metadata = judge("televisão Samsung")
        assert metadata["reason"] == "out_of_domain"


# =============================================================================
# Test ASK_CLARIFICATION Mode
# =============================================================================

class TestAskClarificationMode:
    """Test ASK_CLARIFICATION mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("RXYQ código E3 alta pressão", "VRV with partial model + safety keyword"),
        ("como testar IPM no inverter", "IPM safety query without model"),
        ("ponte de diodos compressor", "diode bridge without model"),
        ("procedimento de segurança alta tensão placa inverter", "safety procedure without model"),
        ("modelo RYYQ8 instalação unidade externa", "partial model - needs full model"),
        ("RXYQ", "partial model pattern"),
        ("split inverter 12000 BTU", "generic split without full model"),
        ("erro U4 comunicação", "error code without model"),
        ("código E3", "generic error code"),
        ("manual de ar-condicionado", "generic manual without family/brand"),
    ])
    def test_ask_clarification_mode(self, query, description):
        """Test queries that should return ASK_CLARIFICATION."""
        result, metadata = judge(query)
        assert result == JuizResult.ASK_CLARIFICATION, f"Expected ASK_CLARIFICATION for: {description}"
        assert metadata["result"] == JuizResult.ASK_CLARIFICATION.value

    def test_ask_clarification_confidence_range(self):
        """Test ASK_CLARIFICATION confidence is within valid range."""
        result, metadata = judge("RXYQ código E3")
        assert 0.0 <= metadata["confidence"] <= 1.0

    def test_ask_clarification_allowed_sources(self):
        """Test ASK_CLARIFICATION allowed sources."""
        result, metadata = judge("erro U4 comunicação")
        assert isinstance(metadata["allowed_sources"], list)


# =============================================================================
# Test GUIDED_TRIAGE Mode
# =============================================================================

class TestGuidedTriageMode:
    """Test GUIDED_TRIAGE mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("erro e4 vrv daikin", "guided_triage: brand+family+error no model"),
        ("e4-01 vrv daikin", "guided_triage: error with subcode but no full model"),
        ("vrf carrier código e3", "guided_triage: vrf family"),
        ("daikin vrv e4", "guided_triage: daikin vrv error"),
    ])
    def test_guided_triage_mode(self, query, description):
        """Test queries that should return GUIDED_TRIAGE."""
        result, metadata = judge(query)
        assert result == JuizResult.GUIDED_TRIAGE, f"Expected GUIDED_TRIAGE for: {description}"
        assert metadata["result"] == JuizResult.GUIDED_TRIAGE.value
        assert metadata["guided_triage"] is True

    def test_guided_triage_evidence_level(self):
        """Test GUIDED_TRIAGE evidence level is GRAPH_KNOWLEDGE."""
        result, metadata = judge("erro e4 vrv daikin")
        assert metadata["evidence_level"] == EvidenceLevel.GRAPH_KNOWLEDGE.value

    def test_guided_triage_can_use_graph(self):
        """Test GUIDED_TRIAGE can_use_graph is True."""
        result, metadata = judge("erro e4 vrv daikin")
        assert metadata["can_use_graph"] is True

    def test_guided_triage_allowed_sources(self):
        """Test GUIDED_TRIAGE allowed sources."""
        result, metadata = judge("erro e4 vrv daikin")
        assert "graph" in metadata["allowed_sources"]
        assert "vector" in metadata["allowed_sources"]

    def test_guided_triage_confidence(self):
        """Test GUIDED_TRIAGE confidence is within valid range."""
        result, metadata = judge("erro e4 vrv daikin")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test MANUAL_EXACT Mode
# =============================================================================

class TestManualExactMode:
    """Test MANUAL_EXACT mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("manual RXYQ20BRA", "manual with exact model"),
        ("baixar manual VRV RXYQ10BRA", "download manual exact model"),
    ])
    def test_manual_exact_mode(self, query, description):
        """Test queries that should return MANUAL_EXACT."""
        result, metadata = judge(query)
        assert result == JuizResult.MANUAL_EXACT, f"Expected MANUAL_EXACT for: {description}"
        assert metadata["result"] == JuizResult.MANUAL_EXACT.value

    def test_manual_exact_evidence_level(self):
        """Test MANUAL_EXACT evidence level is manual_exact."""
        result, metadata = judge("manual RXYQ20BRA")
        assert metadata["evidence_level"] == EvidenceLevel.MANUAL_EXACT.value

    def test_manual_exact_allowed_sources(self):
        """Test MANUAL_EXACT allowed sources."""
        result, metadata = judge("manual RXYQ20BRA")
        assert metadata["allowed_sources"] == ["manual"]

    def test_manual_exact_can_use_web(self):
        """Test MANUAL_EXACT can_use_web_official is True."""
        result, metadata = judge("manual RXYQ20BRA")
        assert metadata["can_use_web_official"] is True

    def test_manual_exact_confidence_high(self):
        """Test MANUAL_EXACT has high confidence."""
        result, metadata = judge("manual RXYQ20BRA")
        assert metadata["confidence"] >= 0.9


# =============================================================================
# Test MANUAL_FAMILY Mode
# =============================================================================

class TestManualFamilyMode:
    """Test MANUAL_FAMILY mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("manual de VRV", "manual family without exact model"),
        ("guia de instalação vrv", "install guide vrv family"),
    ])
    def test_manual_family_mode(self, query, description):
        """Test queries that should return MANUAL_FAMILY."""
        result, metadata = judge(query)
        assert result == JuizResult.MANUAL_FAMILY, f"Expected MANUAL_FAMILY for: {description}"
        assert metadata["result"] == JuizResult.MANUAL_FAMILY.value

    def test_manual_family_evidence_level(self):
        """Test MANUAL_FAMILY evidence level is manual_family."""
        result, metadata = judge("manual de VRV")
        assert metadata["evidence_level"] == EvidenceLevel.MANUAL_FAMILY.value

    def test_manual_family_allowed_sources(self):
        """Test MANUAL_FAMILY allowed sources."""
        result, metadata = judge("manual de VRV")
        assert metadata["allowed_sources"] == ["manual"]

    def test_manual_family_needs_one_question(self):
        """Test MANUAL_FAMILY needs_one_question is True."""
        result, metadata = judge("manual de VRV")
        assert metadata["needs_one_question"] is True

    def test_manual_family_confidence(self):
        """Test MANUAL_FAMILY confidence is within valid range."""
        result, metadata = judge("manual de VRV")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test GRAPH_ASSISTED Mode
# =============================================================================

class TestGraphAssistedMode:
    """Test GRAPH_ASSISTED mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("erro e4-01 vrv daikin sem solução", "graph assisted triage - tried guided already"),
        ("vrv daikin e4 já tentei de tudo", "graph assisted - tried everything"),
        ("vrf carrier e3 sem resultado", "graph assisted - no result"),
    ])
    def test_graph_assisted_mode(self, query, description):
        """Test queries that should return GRAPH_ASSISTED."""
        result, metadata = judge(query)
        assert result == JuizResult.GRAPH_ASSISTED, f"Expected GRAPH_ASSISTED for: {description}"
        assert metadata["result"] == JuizResult.GRAPH_ASSISTED.value

    def test_graph_assisted_evidence_level(self):
        """Test GRAPH_ASSISTED evidence level is GRAPH_KNOWLEDGE."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert metadata["evidence_level"] == EvidenceLevel.GRAPH_KNOWLEDGE.value

    def test_graph_assisted_allowed_sources(self):
        """Test GRAPH_ASSISTED allowed sources."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert "graph" in metadata["allowed_sources"]
        assert "vector" in metadata["allowed_sources"]

    def test_graph_assisted_can_use_graph(self):
        """Test GRAPH_ASSISTED can_use_graph is True."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert metadata["can_use_graph"] is True

    def test_graph_assisted_can_use_web(self):
        """Test GRAPH_ASSISTED can_use_web_official is True."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert metadata["can_use_web_official"] is True

    def test_graph_assisted_can_use_duckduckgo(self):
        """Test GRAPH_ASSISTED can_use_duckduckgo_fallback is True."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert metadata["can_use_duckduckgo_fallback"] is True

    def test_graph_assisted_confidence(self):
        """Test GRAPH_ASSISTED confidence is within valid range."""
        result, metadata = judge("erro e4-01 vrv daikin sem solução")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test WEB_OFFICIAL_ASSISTED Mode
# =============================================================================

class TestWebOfficialAssistedMode:
    """Test WEB_OFFICIAL_ASSISTED mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("especificações técnicas RXYQ20BRA", "technical specs from manufacturer"),
        ("especificacao tecnica VRV", "technical specs without model"),
        ("datasheet manufacturer", "datasheet manufacturer"),
    ])
    def test_web_official_assisted_mode(self, query, description):
        """Test queries that should return WEB_OFFICIAL_ASSISTED."""
        result, metadata = judge(query)
        assert result == JuizResult.WEB_OFFICIAL_ASSISTED, f"Expected WEB_OFFICIAL_ASSISTED for: {description}"
        assert metadata["result"] == JuizResult.WEB_OFFICIAL_ASSISTED.value

    def test_web_official_evidence_level(self):
        """Test WEB_OFFICIAL_ASSISTED evidence level is web_official."""
        result, metadata = judge("especificações técnicas RXYQ20BRA")
        assert metadata["evidence_level"] == EvidenceLevel.WEB_OFFICIAL.value

    def test_web_official_allowed_sources(self):
        """Test WEB_OFFICIAL_ASSISTED allowed sources."""
        result, metadata = judge("especificações técnicas RXYQ20BRA")
        assert "web_official" in metadata["allowed_sources"]
        assert "manufacturer" in metadata["allowed_sources"]

    def test_web_official_can_use_web(self):
        """Test WEB_OFFICIAL_ASSISTED can_use_web_official is True."""
        result, metadata = judge("especificações técnicas RXYQ20BRA")
        assert metadata["can_use_web_official"] is True

    def test_web_official_can_use_duckduckgo(self):
        """Test WEB_OFFICIAL_ASSISTED can_use_duckduckgo_fallback is True."""
        result, metadata = judge("especificações técnicas RXYQ20BRA")
        assert metadata["can_use_duckduckgo_fallback"] is True

    def test_web_official_confidence(self):
        """Test WEB_OFFICIAL_ASSISTED confidence is within valid range."""
        result, metadata = judge("especificações técnicas RXYQ20BRA")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test FIELD_TUTOR Mode
# =============================================================================

class TestFieldTutorMode:
    """Test FIELD_TUTOR mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("como fazer instalação de split", "how to install split"),
        ("passo a passo para configurar ar-condicionado", "step by step configure AC"),
        ("procedimento de manutenção preventiva", "maintenance procedure"),
        ("como diagnosticar erro E4 no VRV", "field tutor diagnostic"),
    ])
    def test_field_tutor_mode(self, query, description):
        """Test queries that should return FIELD_TUTOR."""
        result, metadata = judge(query)
        assert result == JuizResult.FIELD_TUTOR, f"Expected FIELD_TUTOR for: {description}"
        assert metadata["result"] == JuizResult.FIELD_TUTOR.value

    def test_field_tutor_evidence_level(self):
        """Test FIELD_TUTOR evidence level is GRAPH_KNOWLEDGE."""
        result, metadata = judge("como fazer instalação de split")
        assert metadata["evidence_level"] == EvidenceLevel.GRAPH_KNOWLEDGE.value

    def test_field_tutor_allowed_sources(self):
        """Test FIELD_TUTOR allowed sources."""
        result, metadata = judge("como fazer instalação de split")
        assert "graph" in metadata["allowed_sources"]
        assert "knowledge_base" in metadata["allowed_sources"]
        assert "field_guide" in metadata["allowed_sources"]

    def test_field_tutor_can_use_graph(self):
        """Test FIELD_TUTOR can_use_graph is True."""
        result, metadata = judge("como fazer instalação de split")
        assert metadata["can_use_graph"] is True

    def test_field_tutor_can_use_duckduckgo(self):
        """Test FIELD_TUTOR can_use_duckduckgo_fallback is True."""
        result, metadata = judge("como fazer instalação de split")
        assert metadata["can_use_duckduckgo_fallback"] is True

    def test_field_tutor_confidence(self):
        """Test FIELD_TUTOR confidence is within valid range."""
        result, metadata = judge("como fazer instalação de split")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test PRINTABLE Mode
# =============================================================================

class TestPrintableMode:
    """Test PRINTABLE mode behavior."""

    @pytest.mark.parametrize("query,description", [
        ("imprimir manual de manutenção", "print maintenance manual"),
        ("checklist de instalação split", "installation checklist"),
        ("tabela de erros para imprimir", "error table printable"),
        ("pdf para impressão VRV", "printable PDF"),
    ])
    def test_printable_mode(self, query, description):
        """Test queries that should return PRINTABLE."""
        result, metadata = judge(query)
        assert result == JuizResult.PRINTABLE, f"Expected PRINTABLE for: {description}"
        assert metadata["result"] == JuizResult.PRINTABLE.value

    def test_printable_evidence_level_with_model(self):
        """Test PRINTABLE with complete model has manual_exact evidence."""
        result, metadata = judge("imprimir manual RXYQ20BRA")
        assert metadata["evidence_level"] == EvidenceLevel.MANUAL_EXACT.value

    def test_printable_evidence_level_without_model(self):
        """Test PRINTABLE without complete model has manual_family evidence."""
        result, metadata = judge("imprimir manual de manutenção")
        assert metadata["evidence_level"] == EvidenceLevel.MANUAL_FAMILY.value

    def test_printable_allowed_sources(self):
        """Test PRINTABLE allowed sources."""
        result, metadata = judge("imprimir manual de manutenção")
        assert "manual" in metadata["allowed_sources"]
        assert "checklist" in metadata["allowed_sources"]

    def test_printable_can_use_web(self):
        """Test PRINTABLE can_use_web_official is True."""
        result, metadata = judge("imprimir manual de manutenção")
        assert metadata["can_use_web_official"] is True

    def test_printable_confidence(self):
        """Test PRINTABLE confidence is within valid range."""
        result, metadata = judge("imprimir manual de manutenção")
        assert 0.0 <= metadata["confidence"] <= 1.0


# =============================================================================
# Test Flags: needs_one_question
# =============================================================================

class TestNeedsOneQuestionFlag:
    """Test needs_one_question flag behavior."""

    def test_manual_family_needs_one_question(self):
        """Test MANUAL_FAMILY sets needs_one_question=True."""
        result, metadata = judge("manual de VRV")
        assert metadata["needs_one_question"] is True

    def test_generic_manual_needs_one_question(self):
        """Test generic manual request without brand/family needs clarification."""
        result, metadata = judge("manual de ar-condicionado")
        assert metadata["needs_one_question"] is True

    def test_approved_needs_one_question_false(self):
        """Test APPROVED sets needs_one_question=False."""
        result, metadata = judge("RXYQ20BR erro U4")
        assert metadata["needs_one_question"] is False


# =============================================================================
# Test Flags: safety_required
# =============================================================================

class TestSafetyRequiredFlag:
    """Test safety_required flag behavior."""

    def test_safety_with_model_safety_required(self):
        """Test safety query WITH complete model sets safety_required=True."""
        result, metadata = judge("RXYQ20BRA IPM alta tensão")
        assert metadata["safety_required"] is True

    def test_safety_with_model_can_use_graph(self):
        """Test safety query WITH model can use graph."""
        result, metadata = judge("RXYQ20BRA IPM alta tensão")
        assert metadata["can_use_graph"] is True

    def test_safety_with_model_can_use_web(self):
        """Test safety query WITH model can use web."""
        result, metadata = judge("RXYQ20BRA IPM alta tensão")
        assert metadata["can_use_web_official"] is True

    def test_safety_without_model_safety_required(self):
        """Test safety query WITHOUT complete model sets safety_required=True."""
        result, metadata = judge("IPM alta tensão")
        # ASK_CLARIFICATION with safety_only_without_model=True
        assert metadata["safety_required"] is True

    def test_non_safety_query_safety_required_false(self):
        """Test non-safety query sets safety_required=False."""
        result, metadata = judge("RXYQ20BR erro U4")
        assert metadata["safety_required"] is False


# =============================================================================
# Test Flags: can_use_graph
# =============================================================================

class TestCanUseGraphFlag:
    """Test can_use_graph flag behavior."""

    @pytest.mark.parametrize("query,expected", [
        ("erro e4 vrv daikin", True),      # GUIDED_TRIAGE
        ("erro e4-01 vrv daikin sem solução", True),  # GRAPH_ASSISTED
        ("como fazer instalação de split", True),   # FIELD_TUTOR
        ("RXYQ20BR erro U4", False),       # APPROVED
    ])
    def test_can_use_graph(self, query, expected):
        """Test can_use_graph flag for various modes."""
        result, metadata = judge(query)
        assert metadata["can_use_graph"] is expected


# =============================================================================
# Test Flags: can_use_web_official
# =============================================================================

class TestCanUseWebOfficialFlag:
    """Test can_use_web_official flag behavior."""

    @pytest.mark.parametrize("query,expected", [
        ("especificações técnicas RXYQ20BRA", True),  # WEB_OFFICIAL_ASSISTED
        ("erro e4-01 vrv daikin sem solução", True),    # GRAPH_ASSISTED
        ("manual RXYQ20BRA", True),                     # MANUAL_EXACT
        ("imprimir manual de manutenção", True),         # PRINTABLE
        ("RXYQ20BR erro U4", False),                    # APPROVED
    ])
    def test_can_use_web_official(self, query, expected):
        """Test can_use_web_official flag for various modes."""
        result, metadata = judge(query)
        assert metadata["can_use_web_official"] is expected


# =============================================================================
# Test Flags: can_use_duckduckgo_fallback
# =============================================================================

class TestCanUseDuckduckgoFallbackFlag:
    """Test can_use_duckduckgo_fallback flag behavior."""

    @pytest.mark.parametrize("query,expected", [
        ("erro e4-01 vrv daikin sem solução", True),    # GRAPH_ASSISTED
        ("especificações técnicas RXYQ20BRA", True),    # WEB_OFFICIAL_ASSISTED
        ("como fazer instalação de split", True),       # FIELD_TUTOR
        ("RXYQ20BR erro U4", False),                     # APPROVED
    ])
    def test_can_use_duckduckgo_fallback(self, query, expected):
        """Test can_use_duckduckgo_fallback flag for various modes."""
        result, metadata = judge(query)
        assert metadata["can_use_duckduckgo_fallback"] is expected


# =============================================================================
# Test Confidence Scores (0.0 to 1.0)
# =============================================================================

class TestConfidenceScores:
    """Test confidence scores are within valid range."""

    @pytest.mark.parametrize("query", [
        "RXYQ20BR erro U4 comunicação",
        "geladeira frost free",
        "RXYQ código E3 alta pressão",
        "erro e4 vrv daikin",
        "manual RXYQ20BRA",
        "especificações técnicas RXYQ20BRA",
        "como fazer instalação de split",
        "imprimir manual de manutenção",
    ])
    def test_confidence_in_range(self, query):
        """Test confidence is always between 0.0 and 1.0."""
        result, metadata = judge(query)
        assert 0.0 <= metadata["confidence"] <= 1.0, f"Confidence out of range for: {query}"

    def test_confidence_is_float(self):
        """Test confidence is a float."""
        result, metadata = judge("RXYQ20BR erro U4")
        assert isinstance(metadata["confidence"], float)


# =============================================================================
# Test allowed_sources for Each Mode
# =============================================================================

class TestAllowedSources:
    """Test allowed_sources for each mode."""

    @pytest.mark.parametrize("mode,expected_sources", [
        (JuizResult.MANUAL_EXACT, ["manual"]),
        (JuizResult.MANUAL_FAMILY, ["manual"]),
        (JuizResult.GRAPH_ASSISTED, ["graph", "vector"]),
        (JuizResult.WEB_OFFICIAL_ASSISTED, ["web_official", "manufacturer"]),
        (JuizResult.FIELD_TUTOR, ["graph", "knowledge_base", "field_guide"]),
        (JuizResult.PRINTABLE, ["manual", "checklist"]),
        (JuizResult.GUIDED_TRIAGE, ["graph", "vector"]),
    ])
    def test_get_allowed_sources(self, mode, expected_sources):
        """Test get_allowed_sources returns correct sources for each mode."""
        result = get_allowed_sources(mode, has_complete_model=True, has_error_codes=False)
        assert result == expected_sources

    def test_approved_sources_with_error_codes(self):
        """Test APPROVED with error codes includes error_code_db."""
        result = get_allowed_sources(JuizResult.APPROVED, has_complete_model=True, has_error_codes=True)
        assert "vector" in result
        assert "error_code_db" in result

    def test_approved_sources_without_error_codes(self):
        """Test APPROVED without error codes only has vector."""
        result = get_allowed_sources(JuizResult.APPROVED, has_complete_model=True, has_error_codes=False)
        assert result == ["vector"]

    def test_blocked_sources_empty(self):
        """Test BLOCKED has empty allowed sources."""
        result = get_allowed_sources(JuizResult.BLOCKED, has_complete_model=False, has_error_codes=False)
        assert result == []


# =============================================================================
# Test Helper Functions
# =============================================================================

class TestHelperFunctions:
    """Test helper functions."""

    @pytest.mark.parametrize("text,expected", [
        ("RXYQ20BR erro U4", False),  # Model pattern, not HVAC component
        ("split inverter", True),
        ("compressor danfoss", True),
        ("geladeira", False),
        ("tv samsung", True),  # samsung is in HVAC_COMPONENTS (brand)
    ])
    def test_has_hvac_components(self, text, expected):
        """Test has_hvac_components function."""
        assert has_hvac_components(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("erro U4", True),
        ("código E3-01", True),
        ("F5", True),
        ("RXYQ20BRA", False),
        ("teste", False),
    ])
    def test_has_error_codes(self, text, expected):
        """Test has_error_codes function."""
        assert has_error_codes(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("RXYQ20BRA", True),
        ("RYYQ8", True),
        ("daikin", False),
        ("split", False),
    ])
    def test_has_model_patterns(self, text, expected):
        """Test has_model_patterns function."""
        assert has_model_patterns(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("RXYQ20BRA", True),
        ("RYYQ48BRA", True),
        ("RXYQ", False),
        ("RYYQ8", False),
        ("daikin", False),
    ])
    def test_has_complete_model(self, text, expected):
        """Test has_complete_model function."""
        assert has_complete_model(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("geladeira frost free", True),
        ("manual de tv", True),
        ("receita de bolo", True),
        ("RXYQ20BRA erro U4", False),
        ("split inverter", False),
    ])
    def test_is_out_of_domain(self, text, expected):
        """Test is_out_of_domain function."""
        assert is_out_of_domain(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("IPM alta tensão", True),
        ("ponte de diodos", True),
        ("capacitor de partida", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_safety_keywords(self, text, expected):
        """Test has_safety_keywords function."""
        assert has_safety_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("como fazer instalação", True),
        ("passo a passo", True),
        ("procedimento de manutenção", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_field_tutor_keywords(self, text, expected):
        """Test has_field_tutor_keywords function."""
        assert has_field_tutor_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("imprimir manual", True),
        ("checklist de instalação", True),
        ("pdf para impressão", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_printable_keywords(self, text, expected):
        """Test has_printable_keywords function."""
        assert has_printable_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("especificações técnicas", True),
        ("folha de dados", True),
        ("manufacturer", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_web_official_keywords(self, text, expected):
        """Test has_web_official_keywords function."""
        assert has_web_official_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("manual RXYQ20BRA", True),
        ("guia de instalação", True),
        ("baixar manual", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_manual_keywords(self, text, expected):
        """Test has_manual_keywords function."""
        assert has_manual_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("sem solução", True),
        ("já tentei", True),
        ("não funcionou", True),
        ("não resolve", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_has_graph_assisted_keywords(self, text, expected):
        """Test has_graph_assisted_keywords function."""
        assert has_graph_assisted_keywords(text) is expected

    @pytest.mark.parametrize("text,expected", [
        ("erro e4 vrv daikin", True),
        ("vrf carrier código e3", True),
        ("RXYQ20BRA erro U4", False),
    ])
    def test_is_guided_triage_candidate(self, text, expected):
        """Test is_guided_triage_candidate function."""
        assert is_guided_triage_candidate(text) is expected


# =============================================================================
# 35 Validation Cases (Same as --validate)
# =============================================================================

class TestValidationCases:
    """Test all 35 validation cases from --validate."""

    @pytest.mark.parametrize("query,expected_result,description", [
        # Case 1: APPROVED
        ("RXYQ20BR erro U4 comunicação", JuizResult.APPROVED, "valid HVAC with error code"),

        # Case 2: APPROVED
        ("VRV RXYQ10BRA código E3 alta pressão", JuizResult.APPROVED, "VRV with full model - approved"),

        # Case 3: ASK_CLARIFICATION (partial model + safety keyword)
        ("RXYQ código E3 alta pressão", JuizResult.ASK_CLARIFICATION, "VRV with partial model + safety keyword - ASK_CLARIFICATION + safety flag"),

        # Case 4: APPROVED (IPM safety query WITH model)
        ("RXYQ20BRA IPM alta tensão", JuizResult.APPROVED, "IPM safety query WITH model - APPROVED"),

        # Case 5: APPROVED (diode bridge WITH model)
        ("RXYQ20BRA ponte de diodos", JuizResult.APPROVED, "diode bridge WITH model - APPROVED"),

        # Case 6: ASK_CLARIFICATION (IPM safety query without model)
        ("como testar IPM no inverter", JuizResult.ASK_CLARIFICATION, "IPM safety query without model - ASK_CLARIFICATION + safety flag"),

        # Case 7: ASK_CLARIFICATION (diode bridge without model)
        ("ponte de diodos compressor", JuizResult.ASK_CLARIFICATION, "diode bridge without model - ASK_CLARIFICATION + safety flag"),

        # Case 8: ASK_CLARIFICATION (safety procedure without model)
        ("procedimento de segurança alta tensão placa inverter", JuizResult.ASK_CLARIFICATION, "safety procedure without model - ASK_CLARIFICATION + safety flag"),

        # Case 9: ASK_CLARIFICATION (partial model)
        ("modelo RYYQ8 instalação unidade externa", JuizResult.ASK_CLARIFICATION, "partial model - needs full model"),

        # Case 10: ASK_CLARIFICATION (partial model pattern)
        ("RXYQ", JuizResult.ASK_CLARIFICATION, "partial model pattern"),

        # Case 11: ASK_CLARIFICATION (generic split without full model)
        ("split inverter 12000 BTU", JuizResult.ASK_CLARIFICATION, "generic split without full model"),

        # Case 12: BLOCKED (refrigerator)
        ("geladeira frost free", JuizResult.BLOCKED, "refrigerator - blocked"),

        # Case 13: BLOCKED (TV manual)
        ("manual de TV", JuizResult.BLOCKED, "TV manual - blocked"),

        # Case 14: BLOCKED (TV)
        ("televisão Samsung 55 polegadas", JuizResult.BLOCKED, "TV - blocked"),

        # Case 15: BLOCKED (recipe)
        ("receita de bolo de chocolate", JuizResult.BLOCKED, "recipe - blocked"),

        # Case 16: BLOCKED (washing machine)
        ("máquina de lavar Electrolux", JuizResult.BLOCKED, "washing machine - blocked"),

        # Case 17: ASK_CLARIFICATION (error code without model)
        ("erro U4 comunicação", JuizResult.ASK_CLARIFICATION, "error code without model"),

        # Case 18: ASK_CLARIFICATION (generic error code)
        ("código E3", JuizResult.ASK_CLARIFICATION, "generic error code"),

        # Case 19: ASK_CLARIFICATION (generic manual without family/brand)
        ("manual de ar-condicionado", JuizResult.ASK_CLARIFICATION, "generic manual without family/brand"),

        # Case 20: APPROVED (generic inverter question)
        ("como funciona um split inverter", JuizResult.APPROVED, "generic inverter question"),

        # Case 21: GUIDED_TRIAGE
        ("erro e4 vrv daikin", JuizResult.GUIDED_TRIAGE, "guided_triage: brand+family+error no model"),

        # Case 22: GUIDED_TRIAGE
        ("e4-01 vrv daikin", JuizResult.GUIDED_TRIAGE, "guided_triage: error with subcode but no full model"),

        # Case 23: GUIDED_TRIAGE
        ("vrf carrier código e3", JuizResult.GUIDED_TRIAGE, "guided_triage: vrf family"),

        # Case 24: MANUAL_EXACT
        ("manual RXYQ20BRA", JuizResult.MANUAL_EXACT, "manual with exact model"),

        # Case 25: MANUAL_EXACT
        ("baixar manual VRV RXYQ10BRA", JuizResult.MANUAL_EXACT, "download manual exact model"),

        # Case 26: MANUAL_FAMILY
        ("manual de VRV", JuizResult.MANUAL_FAMILY, "manual family without exact model"),

        # Case 27: MANUAL_FAMILY
        ("guia de instalação vrv", JuizResult.MANUAL_FAMILY, "install guide vrv family"),

        # Case 28: FIELD_TUTOR
        ("como fazer instalação de split", JuizResult.FIELD_TUTOR, "how to install split"),

        # Case 29: FIELD_TUTOR
        ("passo a passo para configurar ar-condicionado", JuizResult.FIELD_TUTOR, "step by step configure AC"),

        # Case 30: FIELD_TUTOR
        ("procedimento de manutenção preventiva", JuizResult.FIELD_TUTOR, "maintenance procedure"),

        # Case 31: PRINTABLE
        ("imprimir manual de manutenção", JuizResult.PRINTABLE, "print maintenance manual"),

        # Case 32: PRINTABLE
        ("checklist de instalação split", JuizResult.PRINTABLE, "installation checklist"),

        # Case 33: PRINTABLE
        ("tabela de erros para imprimir", JuizResult.PRINTABLE, "error table printable"),

        # Case 34: GRAPH_ASSISTED
        ("erro e4-01 vrv daikin sem solução", JuizResult.GRAPH_ASSISTED, "graph assisted triage"),

        # Case 35: WEB_OFFICIAL_ASSISTED
        ("especificações técnicas RXYQ20BRA", JuizResult.WEB_OFFICIAL_ASSISTED, "technical specs from manufacturer"),
    ])
    def test_validation_case(self, query, expected_result, description):
        """Test each validation case from --validate."""
        result, metadata = judge(query)
        assert result == expected_result, f"FAILED: {description} | Query: {query} | Expected: {expected_result.value} | Got: {result.value} | Reason: {metadata.get('reason')}"


# =============================================================================
# Test Metadata Structure
# =============================================================================

class TestMetadataStructure:
    """Test metadata structure completeness."""

    def test_metadata_has_required_keys(self):
        """Test metadata has all required keys."""
        result, metadata = judge("RXYQ20BR erro U4 comunicação")
        required_keys = [
            "q_hash", "q_len", "has_hvac_components", "has_error_codes",
            "has_model_patterns", "has_complete_model", "has_safety_keywords",
            "has_manual_keywords", "has_field_tutor_keywords", "has_printable_keywords",
            "is_out_of_domain", "needs_clarification", "safety_only_without_model",
            "guided_triage", "mode", "evidence_level", "allowed_sources",
            "needs_one_question", "safety_required", "can_use_graph",
            "can_use_web_official", "can_use_duckduckgo_fallback", "confidence",
            "result", "reason",
        ]
        for key in required_keys:
            assert key in metadata, f"Missing key: {key}"

    def test_metadata_q_hash_is_short_hash(self):
        """Test q_hash is 8 character hash."""
        result, metadata = judge("RXYQ20BR erro U4")
        assert len(metadata["q_hash"]) == 8
        assert isinstance(metadata["q_hash"], str)

    def test_metadata_q_len_is_int(self):
        """Test q_len is integer length of query."""
        query = "RXYQ20BR erro U4 comunicação"
        result, metadata = judge(query)
        assert metadata["q_len"] == len(query)
        assert isinstance(metadata["q_len"], int)


# =============================================================================
# Test Query Types Parametrized
# =============================================================================

class TestQueryTypes:
    """Parametrized tests for different query types."""

    @pytest.mark.parametrize("query_type,examples", [
        ("error_code_queries", [
            "erro U4",
            "código E3-01",
            "F5",
            "E4-01",
        ]),
        ("model_queries", [
            "RXYQ20BRA",
            "RYYQ48BRA",
            "modelo RXYQ10",
        ]),
        ("brand_queries", [
            "daikin vrv",
            "carrier split",
            "midea inverter",
        ]),
        ("component_queries", [
            "compressor danfoss",
            "filtro split",
            "sensor temperatura",
        ]),
        ("safety_queries", [
            "IPM alta tensão",
            "capacitor de partida",
            "alta pressão",
        ]),
    ])
    def test_query_type_has_hvac_context(self, query_type, examples):
        """Test various query types are recognized as HVAC context."""
        for query in examples:
            result, metadata = judge(query)
            # Should not be BLOCKED
            assert result != JuizResult.BLOCKED, f"BLOCKED: {query}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
