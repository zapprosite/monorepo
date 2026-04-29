#!/usr/bin/env python3
"""HVAC Evidence Coverage Mapper — determines which knowledge layers exist for a given intake.

This module maps an intake result (brand, model, error_code) to available evidence layers
WITHOUT executing retrieval. It only determines what layers COULD be consulted.

Evidence Levels (priority order):
    1. manual_exact      — exact service manual in Qdrant for brand+model
    2. manual_family    — manual from same family (brand/series)
    3. technical_memory — Mem0/Hermes technical memory/relatos
    4. graph_internal   — knowledge graph internal match
    5. official_web     — Tavily search with official manufacturer domains
    6. web_fallback     — general web search
    7. llm_triage       — MiniMax M2.7 provides safe triage without exact data
    8. insufficient_context — cannot provide diagnosis, requires more info
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Known HVAC brands for family grouping
HVAC_BRAND_FAMILIES: dict[str, list[str]] = {
    "DAIKIN": ["DAIKIN", "ARC480A1"],
    "CARRIER": ["CARRIER", "CARRIER-SPLIT", "CARRIER-VRV"],
    "MITSUBISHI": ["MITSUBISHI", "MITSUBISHI-ELECTRIC", "MSZ", "MUZ", "PCA", "PEA"],
    "LG": ["LG", "LG-ELECTRONICS", "ART-COOL", "MONO"],
    "SAMSUNG": ["SAMSUNG", "SAMSUNG-ELECTRONICS", "AR", "AW"],
    "PANASONIC": ["PANASONIC", "MADE", "NSE", "C"],
    "HITACHI": ["HITACHI", "RAS", "RPI"],
    "FUJITSU": ["FUJITSU", "AR", "AS", "AG"],
    "GREE": ["GREE", "GREE-APPLIANCES"],
    "TRANE": ["TRANE", "TRANE-XL", "TRANE-XR"],
    "YORK": ["YORK", "YORK-COLOR", "JCI"],
    "SIEMENS": ["SIEMENS", "SIEMENS-Building"],
    "ELGIN": ["ELGIN", "ELGIN-BR"],
    "CONSUL": ["CONSUL", "CONSUL-BR"],
    "OLMO": ["OLMO", "OLMO-BR"],
}

# Error code patterns by severity/category
ERROR_CODE_PATTERNS = [
    r"\bE\d{3,4}\b",  # Daikin, LG, etc.
    r"\bA\d{3,4}\b",  # Some carriers
    r"\bF\d{3,4}\b",  # Fujitsu, general
    r"\bL\d{3,4}\b",  # Low pressure, etc.
    r"\bU\d{3,4}\b",  # Communication errors
    r"\bP\d{3,4}\b",  # Protection errors
]

# Official manufacturer domains for web search filtering
OFFICIAL_DOMAINS = [
    "daikin.com",
    "carrier.com",
    "carrierglobal.com",
    "mitsubishielectric.com",
    "lg.com",
    "samsung.com",
    "panasonic.com",
    "hitachi.com",
    "fujitsu.com",
    "gree.com",
    "trane.com",
    "johnsoncontrols.com",
    "york.com",
    "siemens.com",
    "elgin.com.br",
    "consul.com.br",
    "olmo.com.br",
]

# High-confidence error codes that typically have documented solutions
HIGH_CONFIDENCE_ERROR_CODES = {
    "E001", "E002", "E003",  # Compressor-related (Daikin)
    "E101", "E102", "E103",  # System errors
    "E401", "E402", "E403",  # Communication
    "F001", "F002", "F003",  # Fan errors
    "L001", "L002", "L003",  # Low pressure
    "P001", "P002", "P003",  # Protection
}


def extract_error_codes(identifier: str) -> list[str]:
    """Extract error codes from a string (model, error_code field, etc.)."""
    codes = set()
    for pat in ERROR_CODE_PATTERNS:
        codes.update(re.findall(pat, identifier.upper()))
    return sorted(codes)


def get_brand_family(brand: str) -> list[str]:
    """Get all brand variants in the same family."""
    brand_upper = brand.upper()
    for family_name, variants in HVAC_BRAND_FAMILIES.items():
        if brand_upper in variants or brand_upper == family_name:
            return variants
    return [brand_upper]


def brand_in_family(brand1: str, brand2: str) -> bool:
    """Check if two brands are in the same family."""
    f1 = get_brand_family(brand1)
    f2 = get_brand_family(brand2)
    return any(b in f2 for b in f1)


def is_official_domain(url: str) -> bool:
    """Check if a URL belongs to an official manufacturer domain."""
    url_lower = url.lower()
    return any(domain in url_lower for domain in OFFICIAL_DOMAINS)


def has_high_confidence_error(error_code: Optional[str]) -> bool:
    """Check if error code is in the high-confidence set."""
    if not error_code:
        return False
    normalized = error_code.upper().strip()
    # Remove leading E/A/F/L/U/P if numeric only
    if re.match(r"^[EAFLUP]\d{3,4}$", normalized):
        return normalized in HIGH_CONFIDENCE_ERROR_CODES
    return False


def infer_evidence_from_intake(intake_result: dict) -> dict:
    """Infer what evidence layers likely exist based on intake metadata alone.

    This is a heuristic that examines brand/model patterns WITHOUT querying
    actual data sources.
    """
    brand = intake_result.get("brand", "").upper()
    model = intake_result.get("model", "")
    error_code = intake_result.get("error_code", "")

    # Track what we infer exists
    inferred: dict[str, bool] = {
        "manual_exact": False,
        "manual_family": False,
        "technical_memory": False,
        "graph_match": "none",
        "official_web": False,
        "web_fallback": False,
        "llm_triage": True,  # Always available as fallback
    }

    missing: list[str] = []
    confidence_factors: list[float] = []

    # Brand presence analysis
    known_brand = any(
        brand in variants for variants in HVAC_BRAND_FAMILIES.values()
    )

    if not brand:
        missing.append("brand")
    elif known_brand:
        confidence_factors.append(0.15)
        # Known brands likely have some documentation
        inferred["manual_family"] = True
    else:
        missing.append("brand (unrecognized)")
        confidence_factors.append(-0.1)

    # Model presence analysis
    if model:
        model_clean = model.strip()
        if len(model_clean) >= 4:
            confidence_factors.append(0.10)
            # Specific model patterns suggest documentation exists
            if re.search(r"\d{4,}", model_clean):  # Model with numbers
                inferred["manual_exact"] = True
                confidence_factors.append(0.15)
    else:
        missing.append("model")
        confidence_factors.append(-0.15)

    # Error code analysis
    error_codes_found = extract_error_codes(error_code) if error_code else []
    if error_codes_found:
        confidence_factors.append(0.10)
        if has_high_confidence_error(error_codes_found[0]):
            confidence_factors.append(0.10)
            # Well-documented error codes increase confidence
            inferred["official_web"] = True
            inferred["web_fallback"] = True
    elif error_code:
        # Unknown error code format
        confidence_factors.append(-0.05)
        missing.append("error_code (unrecognized format)")

    # Web search availability
    if brand and known_brand:
        inferred["official_web"] = True
        inferred["web_fallback"] = True
        confidence_factors.append(0.05)

    return {
        "inferred": inferred,
        "missing": missing,
        "confidence_factors": confidence_factors,
    }


def determine_answer_mode(
    manual_exact: bool,
    manual_family: bool,
    technical_memory: bool,
    graph_match: str,
    evidence_level: str,
    missing: list[str],
) -> str:
    """Determine the appropriate answer mode based on coverage state."""
    if manual_exact:
        return "manual"
    if manual_family:
        return "family"
    if evidence_level in ("official_web", "web_fallback", "llm_triage"):
        return "triage_with_web"
    if technical_memory or graph_match in ("strong", "weak"):
        return "triage_safe"
    if evidence_level == "insufficient_context":
        return "insufficient"
    # Default to safe triage when we have minimal info
    return "triage_safe"


def calculate_confidence(
    manual_exact: bool,
    manual_family: bool,
    technical_memory: bool,
    graph_match: str,
    evidence_level: str,
    confidence_factors: list[float],
) -> float:
    """Calculate confidence score based on available evidence layers."""
    # Base confidence from evidence level
    level_confidence = {
        "manual_exact": 0.95,
        "manual_family": 0.80,
        "technical_memory": 0.70,
        "graph_internal": 0.60,
        "official_web": 0.55,
        "web_fallback": 0.45,
        "llm_triage": 0.35,
        "insufficient_context": 0.10,
    }

    base = level_confidence.get(evidence_level, 0.10)

    # Adjustments
    if manual_exact:
        base = max(base, 0.90)
    if manual_family:
        base = max(base, 0.75)
    if technical_memory:
        base += 0.05
    if graph_match == "strong":
        base += 0.10
    elif graph_match == "weak":
        base += 0.03

    # Apply confidence factors from intake inference
    factor_adjustment = sum(confidence_factors) * 0.1
    base += factor_adjustment

    return round(max(0.0, min(1.0, base)), 2)


def check_coverage(intake_result: dict) -> dict:
    """Check what evidence layers exist for an HVAC intake result.

    This function performs COVERAGE MAPPING only — it does NOT query
    Qdrant, Mem0, or any data source. It determines what layers COULD
    be consulted based on the intake metadata.

    Args:
        intake_result: Dictionary containing:
            - brand: str — equipment brand (e.g., "DAIKIN", "LG")
            - model: str — equipment model identifier
            - error_code: str — optional error code (e.g., "E401")

    Returns:
        Dictionary with coverage map:
            - brand: str — normalized brand
            - model: str — model identifier
            - manual_exact: bool — exact manual exists
            - manual_family: bool — family manual exists
            - technical_memory: bool — technical memory exists
            - graph_match: "strong" | "weak" | "none"
            - web_allowed: bool — web search is permitted
            - answer_mode: str — next action for resolver
            - evidence_level: str — highest available evidence level
            - confidence: float — confidence score (0.0-1.0)
            - missing: list[str] — what info would improve coverage
    """
    brand = intake_result.get("brand", "").strip()
    model = intake_result.get("model", "").strip()
    error_code = intake_result.get("error_code", "").strip()

    # Validate required fields
    if not brand:
        return _insufficient_result(
            brand="",
            model=model,
            missing=["brand"],
            reason="brand is required for coverage mapping",
        )

    brand_upper = brand.upper()

    # Infer evidence from intake metadata alone
    inference = infer_evidence_from_intake(intake_result)
    inferred = inference["inferred"]
    missing = inference["missing"]
    confidence_factors = inference["confidence_factors"]

    # Determine evidence level (highest priority available)
    evidence_level = _determine_evidence_level(
        manual_exact=inferred["manual_exact"],
        manual_family=inferred["manual_family"],
        technical_memory=inferred["technical_memory"],
        graph_match=inferred["graph_match"],
        official_web=inferred["official_web"],
        web_fallback=inferred["web_fallback"],
    )

    # Calculate confidence
    confidence = calculate_confidence(
        manual_exact=inferred["manual_exact"],
        manual_family=inferred["manual_family"],
        technical_memory=inferred["technical_memory"],
        graph_match=inferred["graph_match"],
        evidence_level=evidence_level,
        confidence_factors=confidence_factors,
    )

    # Determine if web search is allowed
    web_allowed = (
        evidence_level in ("official_web", "web_fallback", "llm_triage")
        and not inferred["manual_exact"]
    )

    # Determine answer mode
    answer_mode = determine_answer_mode(
        manual_exact=inferred["manual_exact"],
        manual_family=inferred["manual_family"],
        technical_memory=inferred["technical_memory"],
        graph_match=inferred["graph_match"],
        evidence_level=evidence_level,
        missing=missing,
    )

    # Add missing context suggestions
    missing_suggestions = _suggest_missing_info(
        brand=brand_upper,
        model=model,
        error_code=error_code,
        current_missing=missing,
        evidence_level=evidence_level,
    )

    return {
        "brand": brand_upper,
        "model": model,
        "manual_exact": inferred["manual_exact"],
        "manual_family": inferred["manual_family"],
        "technical_memory": inferred["technical_memory"],
        "graph_match": inferred["graph_match"],
        "web_allowed": web_allowed,
        "answer_mode": answer_mode,
        "evidence_level": evidence_level,
        "confidence": confidence,
        "missing": missing_suggestions,
    }


def _determine_evidence_level(
    manual_exact: bool,
    manual_family: bool,
    technical_memory: bool,
    graph_match: str,
    official_web: bool,
    web_fallback: bool,
) -> str:
    """Determine the highest priority evidence level available."""
    if manual_exact:
        return "manual_exact"
    if manual_family:
        return "manual_family"
    if technical_memory:
        return "technical_memory"
    if graph_match == "strong":
        return "graph_internal"
    if official_web:
        return "official_web"
    if web_fallback:
        return "web_fallback"
    return "insufficient_context"


def _insufficient_result(
    brand: str,
    model: str,
    missing: list[str],
    reason: str,
) -> dict:
    """Return an insufficient coverage result."""
    return {
        "brand": brand,
        "model": model,
        "manual_exact": False,
        "manual_family": False,
        "technical_memory": False,
        "graph_match": "none",
        "web_allowed": False,
        "answer_mode": "insufficient",
        "evidence_level": "insufficient_context",
        "confidence": 0.0,
        "missing": missing,
        "_coverage_error": reason,
    }


def _suggest_missing_info(
    brand: str,
    model: str,
    error_code: str,
    current_missing: list[str],
    evidence_level: str,
) -> list[str]:
    """Suggest what additional information would improve coverage."""
    suggestions = list(current_missing)

    if not model and evidence_level != "insufficient_context":
        suggestions.append(
            "model number would enable exact manual lookup"
        )

    if not error_code and evidence_level in (
        "technical_memory",
        "graph_internal",
        "official_web",
    ):
        suggestions.append(
            "error code would improve diagnostic precision"
        )

    # Evidence-specific suggestions
    if evidence_level == "manual_family" and brand:
        suggestions.append(
            f"exact model number would enable precise {brand} service manual"
        )

    if evidence_level == "technical_memory":
        suggestions.append(
            "additional context (symptoms, operating conditions) would improve memory recall"
        )

    if evidence_level == "graph_internal" and brand:
        suggestions.append(
            f"installing more {brand} technical bulletins would strengthen graph knowledge"
        )

    return suggestions


def get_coverage_summary(coverage_map: dict) -> str:
    """Generate a human-readable summary of the coverage map.

    Args:
        coverage_map: The dictionary returned by check_coverage()

    Returns:
        A formatted string summarizing the coverage state.
    """
    brand = coverage_map.get("brand", "Unknown")
    model = coverage_map.get("model", "Unknown")
    evidence_level = coverage_map.get("evidence_level", "unknown")
    confidence = coverage_map.get("confidence", 0.0)
    answer_mode = coverage_map.get("answer_mode", "unknown")
    missing = coverage_map.get("missing", [])

    # Build evidence description
    evidence_desc = _describe_evidence_level(evidence_level)

    # Build mode description
    mode_desc = _describe_answer_mode(answer_mode)

    # Format missing info
    if missing:
        missing_str = " | ".join(missing[:3])  # Limit to 3 items
        if len(missing) > 3:
            missing_str += f" (+{len(missing) - 3} more)"
    else:
        missing_str = "none"

    lines = [
        f"Coverage Summary for {brand} {model or '(no model)'}",
        f"{'─' * 60}",
        f"Evidence Level : {evidence_level}",
        f"  └─ {evidence_desc}",
        f"Confidence     : {confidence:.0%}",
        f"Answer Mode    : {answer_mode}",
        f"  └─ {mode_desc}",
        f"Web Search     : {'allowed' if coverage_map.get('web_allowed') else 'not needed'}",
        f"Missing Info   : {missing_str}",
    ]

    # Add layer details
    layers = []
    if coverage_map.get("manual_exact"):
        layers.append("EXACT-MANUAL")
    if coverage_map.get("manual_family"):
        layers.append("FAMILY-MANUAL")
    if coverage_map.get("technical_memory"):
        layers.append("TECH-MEMORY")
    if coverage_map.get("graph_match") != "none":
        layers.append(f"GRAPH-{coverage_map['graph_match'].upper()}")

    if layers:
        lines.append(f"Active Layers  : {' | '.join(layers)}")

    return "\n".join(lines)


def _describe_evidence_level(level: str) -> str:
    """Get a description of what an evidence level means."""
    descriptions = {
        "manual_exact": "Precise service manual available for this exact model",
        "manual_family": "Manual available for a related model in the same series",
        "technical_memory": "Technical memories/relatos exist in Mem0/Hermes",
        "graph_internal": "Knowledge graph has relevant connections",
        "official_web": "Official manufacturer documentation accessible via web",
        "web_fallback": "General web search available for this brand",
        "llm_triage": "MiniMax M2.7 can provide safe triage based on general knowledge",
        "insufficient_context": "Not enough information to provide reliable guidance",
    }
    return descriptions.get(level, f"Unknown evidence level: {level}")


def _describe_answer_mode(mode: str) -> str:
    """Get a description of what an answer mode means for the resolver."""
    descriptions = {
        "manual": "Retrieve exact manual content — highest confidence response",
        "family": "Retrieve family manual with model-specific adjustments",
        "triage_with_web": "Use LLM triage enhanced with official web search",
        "triage_safe": "Use LLM triage only — safe generic guidance",
        "insufficient": "Request more information before attempting diagnosis",
    }
    return descriptions.get(mode, f"Unknown mode: {mode}")


# ── Qdrant Payload Coverage ─────────────────────────────────────────────────────

QDRANT_URL = "http://127.0.0.1:6333"
QDRANT_COLLECTION = "hvac_manuals_v1"


def _qdrant_search_payload(
    query_vector: list[float],
    must_filters: list[dict],
    top_k: int = 5,
) -> list[dict]:
    """Execute a Qdrant search with payload filter. Returns hit payloads or empty list."""
    try:
        import requests

        api_key = __import__("os").environ.get("QDRANT_API_KEY", "")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        search_payload = {
            "vector": query_vector,
            "top": top_k,
            "with_payload": True,
        }
        if must_filters:
            search_payload["filter"] = {"must": must_filters}

        r = requests.post(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points/search",
            headers=headers,
            json=search_payload,
            timeout=30,
        )
        if r.status_code == 200:
            return r.json().get("result", [])
        return []
    except Exception:
        return []


def _build_model_filter(model: str) -> list[dict]:
    """Build Qdrant filter for model_candidates contains exact model."""
    return [{"key": "model_candidates", "match": {"value": model}}]


def _build_error_code_filter(error_code: str) -> list[dict]:
    """Build Qdrant filter for error_code_candidates contains exact error code."""
    return [{"key": "error_code_candidates", "match": {"value": error_code}}]


def _build_component_filter(component_tag: str) -> list[dict]:
    """Build Qdrant filter for component_tags contains tag."""
    return [{"key": "component_tags", "match": {"value": component_tag}}]


def _build_doc_type_filter(doc_type: str) -> list[dict]:
    """Build Qdrant filter for doc_type exact match."""
    return [{"key": "doc_type", "match": {"value": doc_type}}]


def _get_embedding(text: str) -> list[float] | None:
    """Get embedding via Ollama."""
    try:
        import requests

        ollama_url = __import__("os").environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
        model = __import__("os").environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
        r = requests.post(
            f"{ollama_url}/api/embeddings",
            headers={"Content-Type": "application/json"},
            json={"model": model, "prompt": text[:2000]},
            timeout=120,
        )
        if r.status_code == 200:
            data = r.json()
            emb = data.get("embedding") or data.get("embeddings", [[]])[0]
            if emb and len(emb) > 0:
                return emb
    except Exception:
        pass
    return None


def query_qdrant_payload_coverage(intake: dict) -> dict:
    """
    Query Qdrant using actual payload filters for coverage determination.

    Implements a 5-rung ladder (matching resolver EvidenceLevel):
        1. manual_exact      → brand + model + doc_type=service_manual
        2. manual_family     → brand + model_family + doc_type=service_manual
        3. error_code_same_brand → brand + error_code_candidates
        4. equipment_family  → equipment_type + component_tags
        5. safety_related    → safety_tags (any match)

    Falls back gracefully when:
        - Qdrant/OLLAMA unavailable (connection error)
        - Payload fields missing (old chunks without brand/model_family)
        - No hits at a given rung

    Returns dict with coverage map plus metadata:
        {
            "manual_exact": bool,
            "manual_family": bool,
            "error_code_same_brand": bool,
            "equipment_family": bool,
            "safety_related": bool,
            "qdrant_available": bool,
            "missing_payload_fields": list[str],
            "evidence_level": str,  # highest available
            "fallback_used": bool,   # true if heuristic was used as fallback
        }
    """
    brand = (intake.get("brand") or intake.get("equipment", {}).get("brand") or "").strip().upper()
    model = (intake.get("model") or intake.get("equipment", {}).get("model") or "").strip()
    error_code = (intake.get("error_code") or "").strip().upper()
    error_codes = intake.get("error_codes", [])
    if error_codes and not error_code:
        error_code = error_codes[0].strip().upper()
    component_tags = intake.get("component_tags", [])
    safety_tags = intake.get("safety_tags", [])

    # Track missing fields
    missing_payload_fields: list[str] = []
    if not brand and not model:
        # Cannot query without any identifier
        return _heuristic_fallback(intake, missing_payload_fields)

    # Try to get embedding for semantic search at each rung
    query_text = f"{brand} {model} {error_code}".strip()
    query_vector = _get_embedding(query_text)

    result = {
        "manual_exact": False,
        "manual_family": False,
        "error_code_same_brand": False,
        "equipment_family": False,
        "safety_related": False,
        "qdrant_available": True,
        "missing_payload_fields": [],
        "evidence_level": "insufficient_context",
        "fallback_used": False,
    }

    try:
        # Rung 1: manual_exact — brand + model + doc_type=service_manual
        if brand and model and query_vector:
            manual_exact_hits = _qdrant_search_payload(
                query_vector,
                [
                    _build_doc_type_filter("service_manual")[0],
                ]
                + (([{"key": "model_candidates", "match": {"value": model}}] if model else [])),
                top_k=3,
            )
            if manual_exact_hits:
                result["manual_exact"] = True

        # Rung 2: manual_family — brand + model_family (inferred from model prefix)
        if brand and model and not result["manual_exact"]:
            model_family_prefix = _infer_model_family(model)
            if model_family_prefix:
                # Search for same model family prefix
                family_hits = _qdrant_search_payload(
                    query_vector,
                    [
                        {"key": "doc_type", "match": {"value": "service_manual"}},
                        {"key": "model_candidates", "match": {"value": model_family_prefix}},
                    ],
                    top_k=3,
                )
                if family_hits:
                    result["manual_family"] = True

        # Rung 3: error_code_same_brand — brand + error_code_candidates
        if brand and error_code and not result["manual_exact"]:
            error_hits = _qdrant_search_payload(
                query_vector,
                [
                    _build_error_code_filter(error_code)[0],
                ],
                top_k=3,
            )
            if error_hits:
                result["error_code_same_brand"] = True

        # Rung 4: equipment_family — equipment_type + component_tags
        if component_tags and not result["manual_exact"]:
            equipment_hits = _qdrant_search_payload(
                query_vector,
                [
                    _build_component_filter(component_tags[0])[0],
                ],
                top_k=3,
            )
            if equipment_hits:
                result["equipment_family"] = True

        # Rung 5: safety_related — safety_tags
        if safety_tags and not result["manual_exact"]:
            safety_hits = _qdrant_search_payload(
                query_vector,
                [
                    {"key": "safety_tags", "match": {"value": safety_tags[0]}},
                ],
                top_k=3,
            )
            if safety_hits:
                result["safety_related"] = True

    except Exception as e:
        logger.warning(f"Qdrant payload query failed, using heuristic fallback: {e}")
        result["qdrant_available"] = False
        result["fallback_used"] = True
        return _heuristic_fallback(intake, missing_payload_fields)

    # Determine highest evidence level
    if result["manual_exact"]:
        result["evidence_level"] = "manual_exact"
    elif result["manual_family"]:
        result["evidence_level"] = "manual_family"
    elif result["error_code_same_brand"]:
        result["evidence_level"] = "technical_memory"  # maps to resolver level
    elif result["equipment_family"]:
        result["evidence_level"] = "graph_internal"
    elif result["safety_related"]:
        result["evidence_level"] = "graph_internal"
    else:
        result["evidence_level"] = "llm_triage"
        result["fallback_used"] = True

    # Track missing payload fields
    result["missing_payload_fields"] = missing_payload_fields

    return result


def _infer_model_family(model: str) -> str | None:
    """Infer model family prefix from model string."""
    if not model:
        return None
    # Extract prefix before numbers or common separators
    match = re.match(r"^([A-Za-z]+)", model)
    if match:
        return match.group(1).upper()
    return None


def _heuristic_fallback(intake: dict, missing_payload_fields: list[str]) -> dict:
    """Fallback when Qdrant is unavailable or payload fields missing."""
    # Use the existing heuristic from check_coverage
    inference = infer_evidence_from_intake(intake)
    inferred = inference["inferred"]

    return {
        "manual_exact": inferred.get("manual_exact", False),
        "manual_family": inferred.get("manual_family", False),
        "error_code_same_brand": False,
        "equipment_family": False,
        "safety_related": False,
        "qdrant_available": False,
        "missing_payload_fields": missing_payload_fields,
        "evidence_level": _determine_evidence_level(
            manual_exact=inferred.get("manual_exact", False),
            manual_family=inferred.get("manual_family", False),
            technical_memory=inferred.get("technical_memory", False),
            graph_match=inferred.get("graph_match", "none"),
            official_web=inferred.get("official_web", False),
            web_fallback=inferred.get("web_fallback", False),
        ),
        "fallback_used": True,
    }


# ── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json, sys

    def _cli():
        """Simple CLI for testing coverage mapping."""
        if len(sys.argv) < 2:
            # Interactive or sample
            sample = {
                "brand": "DAIKIN",
                "model": "RXYQ72PYL",
                "error_code": "E401",
            }
            print(f"Usage: {sys.argv[0]} <intake_json>")
            print(f"\nSample intake:")
            print(json.dumps(sample, indent=2))
            print()
            result = check_coverage(sample)
            print(get_coverage_summary(result))
            return

        try:
            intake = json.loads(sys.argv[1])
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}", file=sys.stderr)
            sys.exit(1)

        result = check_coverage(intake)
        print(get_coverage_summary(result))

    _cli()
