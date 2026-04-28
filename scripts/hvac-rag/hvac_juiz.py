#!/usr/bin/env python3
"""
HVAC Juiz — Pre-flight Judge Agent
Validates HVAC queries before LLM processing.

Output:
  APPROVED       → proceed to Qdrant search
  BLOCKED        → return out-of-domain block message
  ASK_CLARIFICATION → return ask-for-model message

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
    "danfoss", "carrier", "midea", "lg", "daikin", "gree",
    "chiller", "vrv", "cassete", "piso", "teto", "hi-wall", "ar-condicionado",
    "split", "window", "portátil", "deumidificador", "umidificador",
    "bomba", "aquecimento", "refrigereração", "gás", "gás refrigerante",
    "ponte de diodos", "diodo", "diodos", "dc bus", "barramento dc", "link dc", "barramento",
    # Note: "samsung" and "televisão" are excluded - samsung is a brand (not a component)
    # and televisao is OUT_OF_DOMAIN. Brand context is handled via error codes and
    # model patterns rather than via the brand name alone.
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

# Terms that clearly indicate out-of-domain.
# Short terms (<=3 chars) use word-boundary matching to avoid false positives
# (e.g. "tv" inside "ativa" or "ativa[ção]"). "ipm" is excluded because it is
# a SAFETY_KEYWORD (legitimate HVAC component, not out-of-domain).
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


class JuizResult(Enum):
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    ASK_CLARIFICATION = "ASK_CLARIFICATION"


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
    # Normalize to NFC so that composed/decomposed Unicode forms (e.g. ã vs ã+combining)
    # are treated equivalently. This fixes false negatives with terms like "televisão".
    import unicodedata
    text_lower = unicodedata.normalize("NFC", text).lower()
    for term in OUT_OF_DOMAIN_REJECT:
        if len(term) <= 4:
            # Terms <= 4 chars need word boundary to avoid false positives.
            # e.g. \b"tv\b" in "ativa" fails (v→ã no boundary), \b"test\b" in "teste"
            # fails (t→e no boundary), but \b"tv\b" in "tv está" succeeds.
            if re.search(r'\b' + re.escape(term) + r'\b', text_lower, re.IGNORECASE):
                return True
        else:
            # Longer terms are specific enough for substring match.
            if term in text_lower:
                return True
    return False


def has_safety_keywords(text: str) -> bool:
    """Check if query involves safety-critical topics."""
    text_lower = text.lower()
    for keyword in SAFETY_KEYWORDS:
        if keyword in text_lower:
            return True
    return False


def needs_clarification(text: str) -> tuple[bool, bool]:
    """
    Check if query needs model clarification.

    Returns (needs_clarification, safety_only_without_model):
    - needs_clarification: True if query needs model to proceed
    - safety_only_without_model: True if safety query but no complete model
      (needs general safety info + request for model)
    """
    text_lower = text.lower()

    # Safety queries without complete model need clarification with safety flag
    if has_safety_keywords(text):
        if has_complete_model(text):
            return False, False
        return True, True

    # Has error code or component or partial model pattern
    has_hvac_context = (
        has_error_codes(text) or
        has_hvac_components(text) or
        has_model_patterns(text)
    )

    if not has_hvac_context:
        return False, False

    # Has complete model - no clarification needed
    if has_complete_model(text):
        return False, False

    # Has partial model pattern (like RXYQ without numbers) - needs clarification
    if has_model_patterns(text):
        return True, False

    # Has component or error code but no model at all - needs clarification
    return True, False


def judge(query: str) -> tuple[JuizResult, dict]:
    """
    Judge a query and return result + metadata.

    Returns:
        (JuizResult, metadata_dict)
    """
    result = {
        "q_hash": hashlib.sha256(query.encode()).hexdigest()[:8],
        "q_len": len(query),
        "has_hvac_components": False,
        "has_error_codes": False,
        "has_model_patterns": False,
        "has_complete_model": False,
        "has_safety_keywords": False,
        "is_out_of_domain": False,
        "needs_clarification": False,
        "safety_only_without_model": False,
        "result": None,
        "reason": None,
    }

    # Check if needs clarification (safety keywords must be checked before OOD
    # so that legitimate HVAC safety queries like "como testar IPM" are not
    # incorrectly blocked by the short-term "ipm" in OUT_OF_DOMAIN_REJECT).
    needs_clar, safety_only = needs_clarification(query)
    if needs_clar:
        result["needs_clarification"] = True
        result["safety_only_without_model"] = safety_only
        result["has_hvac_components"] = has_hvac_components(query)
        result["has_error_codes"] = has_error_codes(query)
        result["has_model_patterns"] = has_model_patterns(query)
        result["has_complete_model"] = has_complete_model(query)
        result["has_safety_keywords"] = has_safety_keywords(query)
        if safety_only:
            result["result"] = JuizResult.ASK_CLARIFICATION.value
            result["reason"] = "safety_query_needs_model"
        else:
            result["result"] = JuizResult.ASK_CLARIFICATION.value
            result["reason"] = "incomplete_model"
        return JuizResult.ASK_CLARIFICATION, result

    # Check for out-of-domain (fast rejection for clearly non-HVAC queries)
    if is_out_of_domain(query):
        result["is_out_of_domain"] = True
        result["result"] = JuizResult.BLOCKED.value
        result["reason"] = "out_of_domain"
        return JuizResult.BLOCKED, result

    # Domain checks
    result["has_hvac_components"] = has_hvac_components(query)
    result["has_error_codes"] = has_error_codes(query)
    result["has_model_patterns"] = has_model_patterns(query)
    result["has_complete_model"] = has_complete_model(query)
    result["has_safety_keywords"] = has_safety_keywords(query)

    # Check if has any HVAC context
    if not (result["has_hvac_components"] or result["has_error_codes"] or result["has_model_patterns"]):
        # No clear HVAC context - check if it's a generic HVAC question
        # e.g., "como funciona um split inverter"
        if "inverter" in query.lower() or "ar-condicionado" in query.lower() or "split" in query.lower():
            result["has_hvac_components"] = True
            result["result"] = JuizResult.APPROVED.value
            result["reason"] = "generic_hvac_accepted"
            return JuizResult.APPROVED, result

        # Truly ambiguous - ask for clarification
        result["result"] = JuizResult.ASK_CLARIFICATION.value
        result["reason"] = "no_hvac_context"
        return JuizResult.ASK_CLARIFICATION, result

    # APPROVED - has HVAC context
    result["result"] = JuizResult.APPROVED.value
    result["reason"] = "valid_hvac_query"
    return JuizResult.APPROVED, result


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

    # Exit codes
    if result == JuizResult.APPROVED:
        return 0
    elif result == JuizResult.BLOCKED:
        return 1
    else:  # ASK_CLARIFICATION
        return 2


def run_validation():
    """Run validation tests."""
    test_cases = [
        # (query, expected_result, description)
        ("RXYQ20BR erro U4 comunicação", JuizResult.APPROVED, "valid HVAC with error code"),
        ("VRV RXYQ10BRA código E3 alta pressão", JuizResult.APPROVED, "VRV with full model - approved"),
        ("RXYQ código E3 alta pressão", JuizResult.ASK_CLARIFICATION, "VRV with partial model + safety keyword - ASK_CLARIFICATION + safety flag"),
        ("como testar IPM no inverter", JuizResult.ASK_CLARIFICATION, "IPM safety query without model - ASK_CLARIFICATION + safety flag"),
        ("ponte de diodos compressor", JuizResult.ASK_CLARIFICATION, "diode bridge without model - ASK_CLARIFICATION + safety flag"),
        ("procedimento de segurança alta tensão placa inverter", JuizResult.ASK_CLARIFICATION, "safety procedure without model - ASK_CLARIFICATION + safety flag"),
        ("RXYQ20BRA IPM alta tensão", JuizResult.APPROVED, "IPM safety query WITH model - APPROVED"),
        ("RXYQ20BRA ponte de diodos", JuizResult.APPROVED, "diode bridge WITH model - APPROVED"),
        ("modelo RYYQ8 instalação unidade externa", JuizResult.ASK_CLARIFICATION, "partial model - needs full model"),

        # Out of domain - should be BLOCKED
        ("geladeira frost free", JuizResult.BLOCKED, "refrigerator - blocked"),
        ("manual de TV", JuizResult.BLOCKED, "TV manual - blocked"),
        ("televisão Samsung 55 polegadas", JuizResult.BLOCKED, "TV - blocked"),
        ("receita de bolo de chocolate", JuizResult.BLOCKED, "recipe - blocked"),
        ("máquina de lavar Electrolux", JuizResult.BLOCKED, "washing machine - blocked"),

        # Short OOD terms that should NOT false-positive
        ("minha tv está com problema", JuizResult.BLOCKED, "tv as full word - blocked"),
        ("teste de funcionamento", JuizResult.ASK_CLARIFICATION, "teste contains 'test' substring - word boundary prevents match; no HVAC context → ask"),
        ("ativação do sistema", JuizResult.ASK_CLARIFICATION, "ativa contains 'tv' substring - word boundary prevents match; no HVAC context → ask"),
        ("não funciona nada", JuizResult.ASK_CLARIFICATION, "no HVAC context - ask clarification"),
        ("bom dia", JuizResult.ASK_CLARIFICATION, "no HVAC context - ask clarification"),

        # Needs clarification
        ("erro U4 comunicação", JuizResult.ASK_CLARIFICATION, "error code without model"),
        ("código E3", JuizResult.ASK_CLARIFICATION, "generic error code"),
        ("manual de ar-condicionado", JuizResult.ASK_CLARIFICATION, "generic HVAC without model"),

        # Edge cases
        ("RXYQ", JuizResult.ASK_CLARIFICATION, "partial model pattern"),
        ("split inverter 12000 BTU", JuizResult.ASK_CLARIFICATION, "generic split without full model"),
    ]

    passed = 0
    failed = 0

    print("\n=== Juiz Validation ===")
    for query, expected, description in test_cases:
        result, metadata = judge(query)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
            extra = ""
            if metadata.get("safety_only_without_model"):
                extra = " [safety_only_without_model=true]"
            print(f"{status} {description}: {result.value}{extra}")
        else:
            failed += 1
            print(f"{status} {description}: expected {expected.value}, got {result.value}")
            print(f"   Query hash: {metadata.get('q_hash', '?')}")
            print(f"   Reason: {metadata['reason']}")
            if metadata.get("safety_only_without_model"):
                print(f"   safety_only_without_model: {metadata['safety_only_without_model']}")

    print(f"\n{passed}/{passed+failed} passed")
    if failed > 0:
        print(f"FAILURES: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
