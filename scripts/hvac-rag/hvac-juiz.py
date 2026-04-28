#!/usr/bin/env python3
"""
HVAC Juiz — Pre-flight Judge Agent
Validates HVAC queries before LLM processing.

Output:
  APPROVED              → proceed to Qdrant search
  BLOCKED               → return out-of-domain block message
  ASK_CLARIFICATION     → return ask-for-model message
  ASK_ONE_SIMPLE_QUESTION → single clarifying question
  GUIDED_TRIAGE         → use guided triage flow
  MANUAL_EXACT          → found exact manual (exit 4)
  MANUAL_FAMILY         → found family manual, no exact (exit 5)
  GRAPH_ASSISTED        → use triage graph (exit 6)
  WEB_OFFICIAL_ASSISTED → use manufacturer docs (exit 7)
  FIELD_TUTOR           → field tutor mode
  PRINTABLE             → printable output mode

Latency target: <50ms (pure regex, no LLM calls)
"""

import hashlib
import re
import sys
import json
from enum import Enum
from typing import Optional

# =============================================================================
# HVAC Domain Knowledge (same as hvac-rag-pipe.py)
# =============================================================================

HVAC_COMPONENTS = {
    "inversor", "inverter", "ipm", "pcb", "placa", "placa inverter", "inverter board",
    "compressor", "ventilador", "motor", "turbina",
    "capacitor", "capacitor de partida", "sensor", "termistor", "válvula",
    "serpentina", "evaporador", "condensador", "filtro", "desidratador",
    "tubulação", "carga de gás", "refrigerante", "bitzer", "copeland",
    "danfoss", "carrier", "midea", "lg", "samsung", "daikin", "gree",
    "chiller", "vrv", "vrf", "cassete", "piso", "teto", "hi-wall", "ar-condicionado",
    "split", "window", "portátil", "deumidificador", "umidificador",
    "bomba", "aquecimento", "refrigereração", "gás", "gás refrigerante",
    "ponte de diodos", "diodo", "diodos", "dc bus", "barramento dc", "link dc", "barramento",
}

HVAC_ERROR_CODES = re.compile(
    r'\b(E\d{1,4}|A\d{1,4}|F\d{1,4}|U\d{1,4}|L\d{1,4}|P\d{1,4}|C\d{1,4}|d\d{1,4}|'
    r'Y\d{1,4}|J\d{1,4})\b',
    re.IGNORECASE
)

HVAC_MODEL_PATTERNS = re.compile(
    r'\b(RXYQ|RYYQ|FXMQ|FXAQ|FXCQ|FXEQ|FXKQ|FXFQ|FXFRQ|FXFSQ|FXFTQ|FXDQ|FXPQ|FXVQ|'
    r'BRC1|BRC2|BRC3|BRC4|RKXY|RCXY|RAXY|RGXY|AHZ|ANH|AG|HXY|CXY)\b',
    re.IGNORECASE
)

# More permissive pattern for model detection in queries
HVAC_MODEL_IN_QUERY = re.compile(
    r'\b[A-Z]{2,10}[0-9]{1,6}[A-Z0-9]*\b',
    re.IGNORECASE
)

# Terms that clearly indicate out-of-domain
OUT_OF_DOMAIN_REJECT = {
    "geladeira", "refrigerador", "freezer", "frost free",
    "televisão", "tv", "smart tv", "monitor", "notebook", "celular",
    "telefone", "computador", "desktop", "máquina de lavar", "lavadora",
    "secadora", "fogão", "cooktop", "forno", "micro-ondas",
    "automóvel", "carro", "moto", "caminhão",
    "shampoo", "medicamento", "receita", "remédio",
    "bolo", "chocolate", "comida", "alimento", "bebida",
    "futebol", "esporte", "cinema", "filme", "série",
    "notícia", "jornal", "política", "religião",
    "bla", "test", "testing", "asdf", "qwerty",
}

# Safety keywords that require mandatory warnings
SAFETY_KEYWORDS = {
    "ipm", "placa inverter", "inverter board", "ponte de diodos",
    "alta tensão", "alta pressão", "high voltage", "high pressure",
    "capacitor", "barramento link", "link dc", "dc bus",
    "compressor", "energizado", "lockout", "tagout",
}

# Minimum model pattern for "complete" model (has series + 2+ digit number)
# RXYQ20BRA = 4 letters + 2+ digits + optional suffix
# RYYQ8 is partial (only 1 digit), needs full like RYYQ48BRA
COMPLETE_MODEL_PATTERN = re.compile(
    r'\b[A-Z]{2,10}[0-9]{2,6}[A-Z0-9]*\b'
)

# VRV/VRF family identifiers (Chinese variants handled separately in is_guided_triage_candidate)
VRV_VRF_FAMILIES = {"vrv", "vrf"}

# Manual-related keywords
MANUAL_KEYWORDS = {
    "manual", "manual de", "instrução", "instruções", "guia", "guia de",
    "catálogo", "tabela", "esquema", "diagrama", "wiring", "schematic",
    "folheto", "documentação", "doc", "pdf", "download",
}

# Field tutor keywords
FIELD_TUTOR_KEYWORDS = {
    "como fazer", "passo a passo", "tutorial", "instrução de",
    "procedimento", "como instalar", "como configurar", "como reparar",
    "como diagnosticar", "field", "técnico", "técnica de",
}

# Printable keywords
PRINTABLE_KEYWORDS = {
    "imprimir", "printable", "pdf para impressão", "folha", "checklist",
    "tabela de", "lista de", "relatório", "formulário",
}

# Web official / manufacturer docs keywords
WEB_OFFICIAL_KEYWORDS = {
    "especificações técnicas", "especificacao tecnica", "specs", "datasheet",
    "folha de dados", "manufacturer", "fabricante", "catálogo técnico",
    "manual oficial", "documentação oficial", "doc oficial",
}

# Graph assisted keywords - indicates user has already tried guided triage
GRAPH_ASSISTED_KEYWORDS = {
    "sem solução", "não funcionou", "já tentei", "já olhei",
    "já verifiquei", "não resolve", "sem resultado", "não consigo",
    "já fiz isso", "já consultei", "já li", "já tentei de tudo",
}


class JuizResult(Enum):
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    ASK_CLARIFICATION = "ASK_CLARIFICATION"
    ASK_ONE_SIMPLE_QUESTION = "ASK_ONE_SIMPLE_QUESTION"
    GUIDED_TRIAGE = "GUIDED_TRIAGE"
    MANUAL_EXACT = "MANUAL_EXACT"
    MANUAL_FAMILY = "MANUAL_FAMILY"
    GRAPH_ASSISTED = "GRAPH_ASSISTED"
    WEB_OFFICIAL_ASSISTED = "WEB_OFFICIAL_ASSISTED"
    FIELD_TUTOR = "FIELD_TUTOR"
    PRINTABLE = "PRINTABLE"


class EvidenceLevel(Enum):
    MANUAL_EXACT = "manual_exact"
    MANUAL_FAMILY = "manual_family"
    GRAPH_KNOWLEDGE = "graph_knowledge"
    WEB_OFFICIAL = "web_official"
    UNKNOWN = "unknown"


# Exit code mapping
EXIT_CODES = {
    JuizResult.APPROVED: 0,
    JuizResult.BLOCKED: 1,
    JuizResult.ASK_CLARIFICATION: 2,
    JuizResult.GUIDED_TRIAGE: 3,
    JuizResult.ASK_ONE_SIMPLE_QUESTION: 2,  # shares with ASK_CLARIFICATION
    JuizResult.MANUAL_EXACT: 4,
    JuizResult.MANUAL_FAMILY: 5,
    JuizResult.GRAPH_ASSISTED: 6,
    JuizResult.WEB_OFFICIAL_ASSISTED: 7,
    JuizResult.FIELD_TUTOR: 0,  # shares with APPROVED
    JuizResult.PRINTABLE: 0,  # shares with APPROVED
}


def extract_terms(text: str) -> set:
    """Extract individual meaningful terms from text."""
    # Split on whitespace and punctuation, lowercase
    words = re.findall(r'\b[a-zA-Zãáàâéêíóôõúüç-]+\b', text.lower())
    return set(words)


def has_hvac_components(text: str) -> bool:
    """Check if text mentions HVAC components."""
    terms = extract_terms(text)
    return bool(terms & HVAC_COMPONENTS)


def has_error_codes(text: str) -> bool:
    """Check if text contains HVAC error codes."""
    return bool(HVAC_ERROR_CODES.search(text))


def has_model_patterns(text: str) -> bool:
    """Check if text contains HVAC model patterns."""
    return bool(HVAC_MODEL_IN_QUERY.search(text))


def has_complete_model(text: str) -> bool:
    """Check if text has a potentially complete model identifier."""
    # A complete model is something like RXYQ20BR (2+ letters + numbers)
    # vs incomplete like just "RXYQ" or "daikin"
    return bool(COMPLETE_MODEL_PATTERN.search(text))


def is_out_of_domain(text: str) -> bool:
    """Check if query is clearly out of HVAC domain."""
    text_lower = text.lower()
    # Use word boundary matching to avoid substring false positives (e.g., "testar" vs "test")
    for term in OUT_OF_DOMAIN_REJECT:
        # Match whole word only: \b for word boundary
        if re.search(r'\b' + re.escape(term) + r'\b', text_lower):
            return True
    return False


def has_safety_keywords(text: str) -> bool:
    """Check if query involves safety-critical topics."""
    text_lower = text.lower()
    for keyword in SAFETY_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def is_guided_triage_candidate(text: str) -> bool:
    """
    Detecta se query é candidata a guided_triage:
    - Contém marca/fabricante HVAC (daikin, carrier, midea, etc.)
    - Contém família VRV/VRF
    - Contém código de erro principal (E4, E3, U4, E5, etc.)
    - NÃO contém modelo completo
    """
    text_lower = text.lower()

    # Extrair componentes
    terms = extract_terms(text)

    # Verificar família VRV/VRF
    has_vrv_family = bool(VRV_VRF_FAMILIES & terms)

    # Verificar marca HVAC
    hvac_brands = {"daikin", "carrier", "midea", "lg", "samsung", "gree", "danfoss", "hitachi", "panasonic"}
    has_brand = bool(hvac_brands & terms)

    # Verificar código de erro (sem subcódigo)
    error_codes = HVAC_ERROR_CODES.findall(text)
    has_error = len(error_codes) > 0

    # Verificar se tem modelo completo
    has_complete = has_complete_model(text)

    # Candidata se: tem marca + família VRV + erro + sem modelo completo
    return has_brand and has_vrv_family and has_error and not has_complete


def has_manual_keywords(text: str) -> bool:
    """Check if query is about finding a manual."""
    text_lower = text.lower()
    # Check for keyword presence as substring (handles multi-word phrases)
    for keyword in MANUAL_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def has_field_tutor_keywords(text: str) -> bool:
    """Check if query is seeking field tutor / how-to guidance."""
    text_lower = text.lower()
    # Check for keyword presence as substring (handles multi-word phrases)
    for keyword in FIELD_TUTOR_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def has_printable_keywords(text: str) -> bool:
    """Check if query wants printable output."""
    text_lower = text.lower()
    # Check for keyword presence as substring (handles multi-word phrases)
    for keyword in PRINTABLE_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def has_web_official_keywords(text: str) -> bool:
    """Check if query is asking for official/manufacturer documentation."""
    text_lower = text.lower()
    for keyword in WEB_OFFICIAL_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def has_graph_assisted_keywords(text: str) -> bool:
    """Check if query indicates user has already tried guided triage without success."""
    text_lower = text.lower()
    for keyword in GRAPH_ASSISTED_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def needs_clarification(text: str) -> tuple[bool, bool, bool, str]:
    """
    Check if query needs model clarification.

    Returns (needs_clarification, safety_only_without_model, guided_triage, clarification_type):
    - needs_clarification: True if query needs model to proceed
    - safety_only_without_model: True if safety query but no complete model
      (needs general safety info + request for model)
    - guided_triage: True if candidate for guided triage flow
    - clarification_type: "safety" | "model" | "one_question" | "none"
    """
    text_lower = text.lower()

    # Primeiro verificar se é candidato a guided_triage
    if is_guided_triage_candidate(text):
        return False, False, True, "guided_triage"

    # Safety queries without complete model need clarification with safety flag
    if has_safety_keywords(text):
        if has_complete_model(text):
            return False, False, False, "none"
        return True, True, False, "safety"

    # Check for manual search queries - don't flag, handled by judge() specialized logic
    # These return early because they have their own handling in judge()
    if has_manual_keywords(text) and not has_complete_model(text):
        # Has manual intent but no model - let judge() handle via MANUAL_FAMILY
        return False, False, False, "manual_search"

    # Check for field tutor queries - don't flag, handled by judge() specialized logic
    # Must check early because has_hvac_components might trigger needs_clar
    if has_field_tutor_keywords(text):
        return False, False, False, "field_tutor"

    # Check for printable queries - don't flag, handled by judge() specialized logic
    if has_printable_keywords(text):
        return False, False, False, "printable"

    # Check for web official queries - don't flag, handled by judge() specialized logic
    if has_web_official_keywords(text):
        return False, False, False, "web_official"

    # Has error code or component or partial model pattern
    has_hvac_context = (
        has_error_codes(text) or
        has_hvac_components(text) or
        has_model_patterns(text)
    )

    if not has_hvac_context:
        return False, False, False, "none"

    # Check for generic "how does X work" questions - don't ask for model
    text_lower = text.lower()
    generic_patterns = ("como funciona", "o que é", "diferença entre", "como funciona um", "me explique")
    if any(text_lower.startswith(p) or f" {p}" in text_lower for p in generic_patterns):
        return False, False, False, "generic_question"

    # Has complete model - no clarification needed
    if has_complete_model(text):
        return False, False, False, "none"

    # Has partial model pattern (like RXYQ without numbers) - needs clarification
    if has_model_patterns(text):
        return True, False, False, "model"

    # Has component or error code but no model at all - needs clarification
    return True, False, False, "model"


def get_allowed_sources(result: JuizResult, has_complete_model: bool, has_error_codes: bool) -> list:
    """Determine allowed sources based on result type."""
    if result in (JuizResult.MANUAL_EXACT, JuizResult.MANUAL_FAMILY):
        return ["manual"]
    elif result == JuizResult.GRAPH_ASSISTED:
        return ["graph", "vector"]
    elif result == JuizResult.WEB_OFFICIAL_ASSISTED:
        return ["web_official", "manufacturer"]
    elif result == JuizResult.FIELD_TUTOR:
        return ["graph", "knowledge_base", "field_guide"]
    elif result == JuizResult.PRINTABLE:
        return ["manual", "checklist"]
    elif result == JuizResult.GUIDED_TRIAGE:
        return ["graph", "vector"]
    elif result == JuizResult.APPROVED:
        sources = ["vector"]
        if has_error_codes:
            sources.append("error_code_db")
        return sources
    else:
        return []


def judge(query: str) -> tuple[JuizResult, dict]:
    """
    Judge a query and return result + metadata.

    Returns:
        (JuizResult, metadata_dict)
    """
    metadata = {
        "q_hash": hashlib.sha256(query.encode()).hexdigest()[:8],
        "q_len": len(query),
        "has_hvac_components": False,
        "has_error_codes": False,
        "has_model_patterns": False,
        "has_complete_model": False,
        "has_safety_keywords": False,
        "has_manual_keywords": False,
        "has_field_tutor_keywords": False,
        "has_printable_keywords": False,
        "is_out_of_domain": False,
        "needs_clarification": False,
        "safety_only_without_model": False,
        "guided_triage": False,
        "mode": None,
        "evidence_level": EvidenceLevel.UNKNOWN.value,
        "allowed_sources": [],
        "needs_one_question": False,
        "safety_required": False,
        "can_use_graph": False,
        "can_use_web_official": False,
        "can_use_duckduckgo_fallback": False,
        "confidence": 0.0,
        "result": None,
        "reason": None,
    }

    # Check for out-of-domain first (fast rejection)
    if is_out_of_domain(query):
        metadata["is_out_of_domain"] = True
        metadata["result"] = JuizResult.BLOCKED.value
        metadata["reason"] = "out_of_domain"
        metadata["mode"] = JuizResult.BLOCKED.value
        metadata["confidence"] = 1.0
        return JuizResult.BLOCKED, metadata

    # Domain checks
    metadata["has_hvac_components"] = has_hvac_components(query)
    metadata["has_error_codes"] = has_error_codes(query)
    metadata["has_model_patterns"] = has_model_patterns(query)
    metadata["has_complete_model"] = has_complete_model(query)
    metadata["has_safety_keywords"] = has_safety_keywords(query)
    metadata["has_manual_keywords"] = has_manual_keywords(query)
    metadata["has_field_tutor_keywords"] = has_field_tutor_keywords(query)
    metadata["has_printable_keywords"] = has_printable_keywords(query)
    metadata["has_web_official_keywords"] = has_web_official_keywords(query)

    # Check if needs clarification
    needs_clar, safety_only, guided, clar_type = needs_clarification(query)
    metadata["needs_clarification"] = needs_clar
    metadata["safety_only_without_model"] = safety_only

    if needs_clar:
        metadata["guided_triage"] = False
        if safety_only:
            metadata["result"] = JuizResult.ASK_CLARIFICATION.value
            metadata["reason"] = "safety_query_needs_model"
            metadata["mode"] = JuizResult.ASK_CLARIFICATION.value
            metadata["needs_one_question"] = False
            metadata["safety_required"] = True
            metadata["confidence"] = 0.9
        else:
            metadata["result"] = JuizResult.ASK_CLARIFICATION.value
            metadata["reason"] = "incomplete_model"
            metadata["mode"] = JuizResult.ASK_CLARIFICATION.value
            metadata["needs_one_question"] = False
            metadata["confidence"] = 0.8
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.ASK_CLARIFICATION, metadata["has_complete_model"], metadata["has_error_codes"])
        return JuizResult.ASK_CLARIFICATION, metadata

    if guided:
        metadata["needs_clarification"] = False
        metadata["guided_triage"] = True
        # Check if user has already tried guided triage without success
        if has_graph_assisted_keywords(query):
            metadata["result"] = JuizResult.GRAPH_ASSISTED.value
            metadata["reason"] = "graph_assisted_candidate"
            metadata["mode"] = JuizResult.GRAPH_ASSISTED.value
            metadata["evidence_level"] = EvidenceLevel.GRAPH_KNOWLEDGE.value
            metadata["allowed_sources"] = get_allowed_sources(JuizResult.GRAPH_ASSISTED, metadata["has_complete_model"], metadata["has_error_codes"])
            metadata["can_use_graph"] = True
            metadata["can_use_web_official"] = True
            metadata["can_use_duckduckgo_fallback"] = True
            metadata["confidence"] = 0.8
            return JuizResult.GRAPH_ASSISTED, metadata
        metadata["result"] = JuizResult.GUIDED_TRIAGE.value
        metadata["reason"] = "guided_triage_candidate"
        metadata["mode"] = JuizResult.GUIDED_TRIAGE.value
        metadata["evidence_level"] = EvidenceLevel.GRAPH_KNOWLEDGE.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.GUIDED_TRIAGE, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_graph"] = True
        metadata["confidence"] = 0.85
        return JuizResult.GUIDED_TRIAGE, metadata

    # Check for printable request - prioritize over manual when both present
    # Printable with manual keywords takes precedence
    if metadata["has_printable_keywords"] and metadata["has_manual_keywords"]:
        metadata["result"] = JuizResult.PRINTABLE.value
        metadata["reason"] = "printable_manual_request"
        metadata["mode"] = JuizResult.PRINTABLE.value
        metadata["evidence_level"] = EvidenceLevel.MANUAL_EXACT.value if metadata["has_complete_model"] else EvidenceLevel.MANUAL_FAMILY.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.PRINTABLE, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_web_official"] = True
        metadata["confidence"] = 0.9
        return JuizResult.PRINTABLE, metadata

    # Check for printable request (standalone)
    if metadata["has_printable_keywords"] and metadata["has_hvac_components"]:
        metadata["result"] = JuizResult.PRINTABLE.value
        metadata["reason"] = "printable_request"
        metadata["mode"] = JuizResult.PRINTABLE.value
        metadata["evidence_level"] = EvidenceLevel.MANUAL_EXACT.value if metadata["has_complete_model"] else EvidenceLevel.MANUAL_FAMILY.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.PRINTABLE, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_web_official"] = True
        metadata["confidence"] = 0.9
        return JuizResult.PRINTABLE, metadata

    # Check for field tutor request (even without explicit HVAC components)
    if metadata["has_field_tutor_keywords"]:
        metadata["result"] = JuizResult.FIELD_TUTOR.value
        metadata["reason"] = "field_tutor_request"
        metadata["mode"] = JuizResult.FIELD_TUTOR.value
        metadata["evidence_level"] = EvidenceLevel.GRAPH_KNOWLEDGE.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.FIELD_TUTOR, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_graph"] = True
        metadata["can_use_duckduckgo_fallback"] = True
        metadata["confidence"] = 0.85
        return JuizResult.FIELD_TUTOR, metadata

    # Check for web official / manufacturer docs request
    if metadata["has_web_official_keywords"]:
        metadata["result"] = JuizResult.WEB_OFFICIAL_ASSISTED.value
        metadata["reason"] = "web_official_request"
        metadata["mode"] = JuizResult.WEB_OFFICIAL_ASSISTED.value
        metadata["evidence_level"] = EvidenceLevel.WEB_OFFICIAL.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.WEB_OFFICIAL_ASSISTED, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_web_official"] = True
        metadata["can_use_duckduckgo_fallback"] = True
        metadata["confidence"] = 0.9
        return JuizResult.WEB_OFFICIAL_ASSISTED, metadata

    # Check for manual search with complete model
    if metadata["has_manual_keywords"]:
        if metadata["has_complete_model"]:
            metadata["result"] = JuizResult.MANUAL_EXACT.value
            metadata["reason"] = "manual_exact_found"
            metadata["mode"] = JuizResult.MANUAL_EXACT.value
            metadata["evidence_level"] = EvidenceLevel.MANUAL_EXACT.value
            metadata["allowed_sources"] = get_allowed_sources(JuizResult.MANUAL_EXACT, metadata["has_complete_model"], metadata["has_error_codes"])
            metadata["can_use_web_official"] = True
            metadata["confidence"] = 0.95
            return JuizResult.MANUAL_EXACT, metadata
        else:
            # Check if query has a specific family or brand - if not, ask for clarification
            text_lower = query.lower()
            has_family = any(f in text_lower for f in ["vrv", "vrf", "split", "cassete", "piso", "teto", "hi-wall", "portátil", "janela"])
            has_brand = any(b in text_lower for b in ["daikin", "carrier", "midea", "lg", "samsung", "gree", "danfoss", "hitachi", "panasonic"])
            if not (has_family or has_brand):
                # Generic "manual de X" without specific family/brand - ask for clarification
                metadata["result"] = JuizResult.ASK_CLARIFICATION.value
                metadata["reason"] = "generic_manual_request"
                metadata["mode"] = JuizResult.ASK_CLARIFICATION.value
                metadata["needs_one_question"] = True
                metadata["confidence"] = 0.7
                return JuizResult.ASK_CLARIFICATION, metadata
            metadata["result"] = JuizResult.MANUAL_FAMILY.value
            metadata["reason"] = "manual_family_search"
            metadata["mode"] = JuizResult.MANUAL_FAMILY.value
            metadata["evidence_level"] = EvidenceLevel.MANUAL_FAMILY.value
            metadata["allowed_sources"] = get_allowed_sources(JuizResult.MANUAL_FAMILY, metadata["has_complete_model"], metadata["has_error_codes"])
            metadata["needs_one_question"] = True
            metadata["confidence"] = 0.7
            return JuizResult.MANUAL_FAMILY, metadata

    # Check if has any HVAC context
    if not (metadata["has_hvac_components"] or metadata["has_error_codes"] or metadata["has_model_patterns"]):
        # No clear HVAC context - check if it's a generic HVAC question
        # e.g., "como funciona um split inverter"
        if "inverter" in query.lower() or "ar-condicionado" in query.lower() or "split" in query.lower():
            metadata["has_hvac_components"] = True
            metadata["result"] = JuizResult.APPROVED.value
            metadata["reason"] = "generic_hvac_accepted"
            metadata["mode"] = JuizResult.APPROVED.value
            metadata["evidence_level"] = EvidenceLevel.UNKNOWN.value
            metadata["allowed_sources"] = get_allowed_sources(JuizResult.APPROVED, metadata["has_complete_model"], metadata["has_error_codes"])
            metadata["confidence"] = 0.7
            return JuizResult.APPROVED, metadata

        # Truly ambiguous - ask for clarification
        metadata["result"] = JuizResult.ASK_CLARIFICATION.value
        metadata["reason"] = "no_hvac_context"
        metadata["mode"] = JuizResult.ASK_CLARIFICATION.value
        metadata["confidence"] = 0.5
        return JuizResult.ASK_CLARIFICATION, metadata

    # Safety keywords with complete model
    if metadata["has_safety_keywords"] and metadata["has_complete_model"]:
        metadata["safety_required"] = True
        metadata["can_use_graph"] = True
        metadata["can_use_web_official"] = True

    # Web official assisted - user asking for technical specifications
    if has_web_official_keywords(query):
        metadata["result"] = JuizResult.WEB_OFFICIAL_ASSISTED.value
        metadata["reason"] = "web_official_request"
        metadata["mode"] = JuizResult.WEB_OFFICIAL_ASSISTED.value
        metadata["evidence_level"] = EvidenceLevel.WEB_OFFICIAL.value
        metadata["allowed_sources"] = get_allowed_sources(JuizResult.WEB_OFFICIAL_ASSISTED, metadata["has_complete_model"], metadata["has_error_codes"])
        metadata["can_use_web_official"] = True
        metadata["can_use_duckduckgo_fallback"] = True
        metadata["confidence"] = 0.85
        return JuizResult.WEB_OFFICIAL_ASSISTED, metadata

    # APPROVED - has HVAC context
    metadata["result"] = JuizResult.APPROVED.value
    metadata["reason"] = "valid_hvac_query"
    metadata["mode"] = JuizResult.APPROVED.value
    metadata["evidence_level"] = EvidenceLevel.UNKNOWN.value
    metadata["allowed_sources"] = get_allowed_sources(JuizResult.APPROVED, metadata["has_complete_model"], metadata["has_error_codes"])
    metadata["confidence"] = 0.85 if metadata["has_complete_model"] else 0.6
    return JuizResult.APPROVED, metadata


# =============================================================================
# CLI Interface
# =============================================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(description="HVAC Juiz — Pre-flight judge")
    parser.add_argument("query", nargs="?", help="Query to judge")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--validate", action="store_true", help="Run validation tests")
    args = parser.parse_args()

    if args.validate:
        run_validation()
        return 0

    if not args.query:
        # Read from stdin if no query provided
        query = sys.stdin.read().strip()
    else:
        query = args.query

    if not query:
        print("ERROR: No query provided", file=sys.stderr)
        return 1

    result, metadata = judge(query)

    if args.json:
        print(json.dumps({"result": result.value, "metadata": metadata}, indent=2))
    else:
        print(f"JUIZ: {result.value}")
        print(f"REASON: {metadata['reason']}")
        if result == JuizResult.ASK_CLARIFICATION:
            print("MESSAGE: Por favor, forneça o modelo completo (ex.: RXYQ20BRA + FXYC20BRA)")
        elif result == JuizResult.BLOCKED:
            print("MESSAGE: Esta base é especializada em ar-condicionado, climatização e refrigeração.")
        elif result == JuizResult.GUIDED_TRIAGE:
            print("MESSAGE: Vou ajudar a identificar o problema. Primeiro, qual é o subcódigo do erro? (ex: E4-01, E4-001)")
        elif result == JuizResult.MANUAL_EXACT:
            print("MESSAGE: Encontrei o manual exato para seu modelo.")
        elif result == JuizResult.MANUAL_FAMILY:
            print("MESSAGE: Encontrei o manual da família. Qual é o modelo completo?")
        elif result == JuizResult.FIELD_TUTOR:
            print("MESSAGE: Vou guiá-lo passo a passo no campo.")
        elif result == JuizResult.PRINTABLE:
            print("MESSAGE: Preparando versão para impressão.")

    # Exit codes
    return EXIT_CODES.get(result, 1)


def run_validation():
    """Run validation tests."""
    test_cases = [
        # (query, expected_result, description)
        ("RXYQ20BR erro U4 comunicação", JuizResult.APPROVED, "valid HVAC with error code"),

        # VRV cases
        ("VRV RXYQ10BRA código E3 alta pressão", JuizResult.APPROVED, "VRV with full model - approved"),
        ("RXYQ código E3 alta pressão", JuizResult.ASK_CLARIFICATION, "VRV with partial model + safety keyword - ASK_CLARIFICATION + safety flag"),
        ("RXYQ20BRA IPM alta tensão", JuizResult.APPROVED, "IPM safety query WITH model - APPROVED"),
        ("RXYQ20BRA ponte de diodos", JuizResult.APPROVED, "diode bridge WITH model - APPROVED"),

        # Safety queries
        ("como testar IPM no inverter", JuizResult.ASK_CLARIFICATION, "IPM safety query without model - ASK_CLARIFICATION + safety flag"),
        ("ponte de diodos compressor", JuizResult.ASK_CLARIFICATION, "diode bridge without model - ASK_CLARIFICATION + safety flag"),
        ("procedimento de segurança alta tensão placa inverter", JuizResult.ASK_CLARIFICATION, "safety procedure without model - ASK_CLARIFICATION + safety flag"),

        # Model clarification
        ("modelo RYYQ8 instalação unidade externa", JuizResult.ASK_CLARIFICATION, "partial model - needs full model"),
        ("RXYQ", JuizResult.ASK_CLARIFICATION, "partial model pattern"),
        ("split inverter 12000 BTU", JuizResult.ASK_CLARIFICATION, "generic split without full model"),

        # Out of domain - should be BLOCKED
        ("geladeira frost free", JuizResult.BLOCKED, "refrigerator - blocked"),
        ("manual de TV", JuizResult.BLOCKED, "TV manual - blocked"),
        ("televisão Samsung 55 polegadas", JuizResult.BLOCKED, "TV - blocked"),
        ("receita de bolo de chocolate", JuizResult.BLOCKED, "recipe - blocked"),
        ("máquina de lavar Electrolux", JuizResult.BLOCKED, "washing machine - blocked"),

        # Needs clarification
        ("erro U4 comunicação", JuizResult.ASK_CLARIFICATION, "error code without model"),
        ("código E3", JuizResult.ASK_CLARIFICATION, "generic error code"),
        ("manual de ar-condicionado", JuizResult.ASK_CLARIFICATION, "generic manual without family/brand"),

        # Edge cases
        ("como funciona um split inverter", JuizResult.APPROVED, "generic inverter question"),

        # Guided triage cases
        ("erro e4 vrv daikin", JuizResult.GUIDED_TRIAGE, "guided_triage: brand+family+error no model"),
        ("e4-01 vrv daikin", JuizResult.GUIDED_TRIAGE, "guided_triage: error with subcode but no full model"),
        ("vrf carrier código e3", JuizResult.GUIDED_TRIAGE, "guided_triage: vrf family"),

        # Manual exact cases (with complete model)
        ("manual RXYQ20BRA", JuizResult.MANUAL_EXACT, "manual with exact model"),
        ("baixar manual VRV RXYQ10BRA", JuizResult.MANUAL_EXACT, "download manual exact model"),

        # Manual family cases (without complete model)
        ("manual de VRV", JuizResult.MANUAL_FAMILY, "manual family without exact model"),
        ("guia de instalação vrv", JuizResult.MANUAL_FAMILY, "install guide vrv family"),

        # Field tutor cases
        ("como fazer instalação de split", JuizResult.FIELD_TUTOR, "how to install split"),
        ("passo a passo para configurar ar-condicionado", JuizResult.FIELD_TUTOR, "step by step configure AC"),
        ("procedimento de manutenção preventiva", JuizResult.FIELD_TUTOR, "maintenance procedure"),

        # Printable cases
        ("imprimir manual de manutenção", JuizResult.PRINTABLE, "print maintenance manual"),
        ("checklist de instalação split", JuizResult.PRINTABLE, "installation checklist"),
        ("tabela de erros para imprimir", JuizResult.PRINTABLE, "error table printable"),

        # Graph assisted cases
        ("erro e4-01 vrv daikin sem solução", JuizResult.GRAPH_ASSISTED if is_guided_triage_candidate("erro e4-01 vrv daikin") else JuizResult.GRAPH_ASSISTED, "graph assisted triage"),

        # Web official assisted
        ("especificações técnicas RXYQ20BRA", JuizResult.WEB_OFFICIAL_ASSISTED, "technical specs from manufacturer"),
    ]

    passed = 0
    failed = 0

    print("\n=== Juiz Validation ===")
    for query, expected, description in test_cases:
        result, metadata = judge(query)
        status = "PASS" if result == expected else "FAIL"
        if result == expected:
            passed += 1
            extra_parts = []
            if metadata.get("safety_only_without_model"):
                extra_parts.append("safety_only_without_model=true")
            if metadata.get("guided_triage"):
                extra_parts.append("guided_triage=true")
            if metadata.get("needs_one_question"):
                extra_parts.append("needs_one_question=true")
            if metadata.get("mode"):
                extra_parts.append(f"mode={metadata['mode']}")
            extra = f" [{', '.join(extra_parts)}]" if extra_parts else ""
            print(f"[{status}] {description}: {result.value}{extra}")
        else:
            failed += 1
            print(f"[{status}] {description}: expected {expected.value}, got {result.value}")
            print(f"       Query: {query}")
            print(f"       Query hash: {metadata.get('q_hash', '?')}")
            print(f"       Reason: {metadata['reason']}")
            if metadata.get("safety_only_without_model"):
                print(f"       safety_only_without_model: {metadata['safety_only_without_model']}")

    print(f"\n{passed}/{passed+failed} passed")
    if failed > 0:
        print(f"FAILURES: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
