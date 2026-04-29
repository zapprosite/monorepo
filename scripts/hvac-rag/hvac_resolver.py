"""
HVAC Universal Resolver — Evidence-based triage core.

Replaces RAG-first with resolver-first approach: determines what evidence
is available and selects the appropriate response strategy before
making any LLM or search calls.

Evidence Ladder (priority order):
    1. manual_exact       → respond with manual
    2. manual_family      → respond as family, note difference
    3. technical_memory   → use tech memory, cite source
    4. graph_internal     → use as diagnostic hint
    5. official_web       → Tavily search, cite source
    6. web_fallback       → general search, note confidence
    7. llm_triage         → MiniMax safe triage, no invented values
    8. insufficient_context → ask for more info, safety only

IMPORTANT: This module does NOT make actual LLM/RAG calls. It only:
    1. Determines what evidence is available
    2. Selects the appropriate response strategy
    3. Sets safety flags and value restrictions
    4. Returns instructions for the caller (hvac_rag_pipe.py)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Optional


class EvidenceLevel(Enum):
    """Evidence hierarchy — higher enum value = lower priority."""

    MANUAL_EXACT = auto()
    MANUAL_FAMILY = auto()
    FIELD_EXPERIENCE = auto()  # rung 3: field expertise before technical_memory
    TECHNICAL_MEMORY = auto()
    GRAPH_INTERNAL = auto()
    OFFICIAL_WEB = auto()
    WEB_FALLBACK = auto()
    LLM_TRIAGE = auto()
    INSUFFICIENT_CONTEXT = auto()


# Safety flag definitions — must be set when content involves these topics.
SAFETY_FLAGS = {
    "IPM": "IPM (Integrated Panel Module) — requires qualified technician",
    "HIGH_VOLTAGE": "High voltage present — de-energize before servicing",
    "COMPRESSOR": "Compressor — sealed unit, no field repair",
    "DC_BUS": "DC bus capacitors — wait 5 min after power off",
    "ENERGIZED_MEASUREMENT": "Live measurements require appropriate PPE and training",
    "REFRIGERANT_PRESSURE": "Refrigerant pressure — use gauges, never guess",
    "WELDING_SOLDERING": "Welding/soldering — certified technician required",
    "EPA_CERTIFICATION": "EPA 608 certification required for refrigerant handling",
}

# Technical values to block from user-facing output when evidence is weak.
BLOCKED_VALUE_PATTERNS = [
    re.compile(r"\b\d+\.\d+\s*[AV]\b", re.IGNORECASE),  # voltage values like 220.0V
    re.compile(r"\b\d+\s*Hz\b", re.IGNORECASE),  # frequency
    re.compile(r"\b\d+\s*PSI\b", re.IGNORECASE),  # pressure
    re.compile(r"\b\d+\s*MPa\b", re.IGNORECASE),  # pressure
    re.compile(r"\b\d+\s*ohm\b", re.IGNORECASE),  # resistance
    re.compile(r"\b\d+\s*uF\b", re.IGNORECASE),  # capacitance
    re.compile(r"\bDC\s*bus\b", re.IGNORECASE),  # DC bus specific
    re.compile(r"\bIPM\b", re.IGNORECASE),  # IPM module
    re.compile(r"\bIGBT\b", re.IGNORECASE),  # IGBT module
    re.compile(r"\binverter\s*module\b", re.IGNORECASE),  # inverter module
]

# Patterns that should never appear in user-facing output.
SUPPRESSED_PATTERNS = {
    "graph_internal": "Graph interno",
    "manual_exact": "Evidência: manual_exact",
    "tavily": "Tavily",
    "ddg": "DDG",
    "qdrant": "Qdrant",
}

# Substitution mapping for suppressed patterns.
PUBLIC_SUBSTITUTIONS = {
    "graph_internal": "base técnica",
    "manual_exact": "manual",
    "tavily": "consulta externa",
    "ddg": "consulta externa",
    "qdrant": "base técnica",
}


@dataclass
class ResolverOptions:
    """Options that influence resolver behavior."""

    allow_web: bool = True
    allow_llm_triage: bool = True
    strict_safety: bool = True
    confidence_threshold: float = 0.6
    prefer_exact_match: bool = True
    block_all_technical_values: bool = True


@dataclass
class CoverageMap:
    """Represents the availability of evidence sources."""

    manual_exact: bool = False
    manual_family: bool = False
    field_experience: bool = False
    technical_memory: bool = False
    graph_internal: bool = False
    official_web: bool = False
    web_fallback: bool = False
    llm_triage: bool = False

    def highest_available(self) -> EvidenceLevel:
        """Return the highest-priority evidence level that is available."""
        if self.manual_exact:
            return EvidenceLevel.MANUAL_EXACT
        if self.manual_family:
            return EvidenceLevel.MANUAL_FAMILY
        if self.field_experience:
            return EvidenceLevel.FIELD_EXPERIENCE
        if self.technical_memory:
            return EvidenceLevel.TECHNICAL_MEMORY
        if self.graph_internal:
            return EvidenceLevel.GRAPH_INTERNAL
        if self.official_web:
            return EvidenceLevel.OFFICIAL_WEB
        if self.web_fallback:
            return EvidenceLevel.WEB_FALLBACK
        if self.llm_triage:
            return EvidenceLevel.LLM_TRIAGE
        return EvidenceLevel.INSUFFICIENT_CONTEXT

    def to_dict(self) -> dict[str, bool]:
        return {
            "manual_exact": self.manual_exact,
            "manual_family": self.manual_family,
            "field_experience": self.field_experience,
            "technical_memory": self.technical_memory,
            "graph_internal": self.graph_internal,
            "official_web": self.official_web,
            "web_fallback": self.web_fallback,
            "llm_triage": self.llm_triage,
        }


@dataclass
class ResolverResult:
    """Return type for the resolve function."""

    answer_mode: str
    evidence_level: EvidenceLevel
    context_layers: list[str]
    next_question: Optional[str]
    safety_flags: list[str]
    blocked_values: list[str]
    provider_hints: dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    source_citation: Optional[str] = None
    family_note: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "answer_mode": self.answer_mode,
            "evidence_level": self.evidence_level.name,
            "context_layers": self.context_layers,
            "next_question": self.next_question,
            "safety_flags": self.safety_flags,
            "blocked_values": self.blocked_values,
            "provider_hints": self.provider_hints,
            "confidence": self.confidence,
            "source_citation": self.source_citation,
            "family_note": self.family_note,
        }


def resolve(intake_result: dict[str, Any], coverage_map: dict[str, bool], options: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """
    Universal resolver entry point.

    Args:
        intake_result: Contains fields like "query", "domain", "equipment",
                       "symptoms", "error_codes", "safety_flags_raised"
        coverage_map: Dict mapping evidence source names to availability booleans.
                      Expected keys: manual_exact, manual_family, technical_memory,
                      graph_internal, official_web, web_fallback, llm_triage
        options: Optional overrides for ResolverOptions fields.

    Returns:
        {
            "answer_mode": str,      # how to format the response
            "evidence_level": str,   # which evidence was selected
            "context_layers": list[str],  # which layers to consult
            "next_question": str|None,    # what to ask next (or None)
            "safety_flags": list[str],
            "blocked_values": list[str], # technical values not to mention
            "provider_hints": dict,       # internal notes (never exposed to user)
        }

    Evidence Ladder (priority order):
        1. manual_exact       → respond with manual
        2. manual_family      → respond as family, note difference
        3. field_experience   → use field expertise, cite author
        4. technical_memory   → use tech memory, cite source
        5. graph_internal     → use as diagnostic hint
        6. official_web       → Tavily search, cite source
        7. web_fallback       → general search, note confidence
        8. llm_triage         → MiniMax safe triage, no invented values
        9. insufficient_context → ask for more info, safety only
    """
    opts = ResolverOptions(**(options or {}))
    cov = _build_coverage(coverage_map)

    # Raise safety flags from intake if present.
    intake_safety_flags = _extract_safety_flags(intake_result)
    all_safety_flags = set(intake_safety_flags)

    # Determine the primary evidence level.
    level = cov.highest_available()

    # If insufficient context but safety flags raised, escalate to llm_triage.
    if level == EvidenceLevel.INSUFFICIENT_CONTEXT:
        if opts.allow_llm_triage:
            level = EvidenceLevel.LLM_TRIAGE
        else:
            level = EvidenceLevel.INSUFFICIENT_CONTEXT

    # Build context layers based on evidence level.
    context_layers = _build_context_layers(level, cov, opts)

    # Determine answer mode.
    answer_mode = _determine_answer_mode(level, intake_result)

    # Build source citation (internal only, never exposed directly).
    source_citation = _build_source_citation(level, intake_result)

    # Determine family note if manual_family.
    family_note = None
    if level == EvidenceLevel.MANUAL_FAMILY:
        family_note = _build_family_note(intake_result)

    # Block values based on evidence level.
    blocked_values = _determine_blocked_values(level, opts)

    # Extract next question if needed.
    next_question = _determine_next_question(level, intake_result, cov, opts)

    # Additional safety flags based on evidence level.
    level_safety_flags = _get_level_safety_flags(level)
    all_safety_flags.update(level_safety_flags)

    # Provider hints — internal only.
    provider_hints = _build_provider_hints(level, intake_result, cov, opts)

    # Compute confidence based on evidence level.
    confidence = _compute_confidence(level, cov)

    result = ResolverResult(
        answer_mode=answer_mode,
        evidence_level=level,
        context_layers=context_layers,
        next_question=next_question,
        safety_flags=sorted(all_safety_flags),
        blocked_values=blocked_values,
        provider_hints=provider_hints,
        confidence=confidence,
        source_citation=source_citation,
        family_note=family_note,
    )

    return result.to_dict()


def _build_coverage(coverage_map: dict[str, bool]) -> CoverageMap:
    """Normalize coverage_map into a CoverageMap dataclass."""
    return CoverageMap(
        manual_exact=coverage_map.get("manual_exact", False),
        manual_family=coverage_map.get("manual_family", False),
        technical_memory=coverage_map.get("technical_memory", False),
        graph_internal=coverage_map.get("graph_internal", False),
        official_web=coverage_map.get("official_web", False),
        web_fallback=coverage_map.get("web_fallback", False),
        llm_triage=coverage_map.get("llm_triage", False),
    )


def _extract_safety_flags(intake_result: dict[str, Any]) -> list[str]:
    """Extract safety flags from intake_result if present."""
    if not intake_result:
        return []
    flags = intake_result.get("safety_flags_raised", [])
    if isinstance(flags, list):
        return [f for f in flags if f in SAFETY_FLAGS]
    return []


def _build_context_layers(level: EvidenceLevel, cov: CoverageMap, opts: ResolverOptions) -> list[str]:
    """Build the ordered list of context layers to consult."""
    layers = []

    if level == EvidenceLevel.MANUAL_EXACT:
        layers = ["manual_exact"]
    elif level == EvidenceLevel.MANUAL_FAMILY:
        layers = ["manual_family", "manual_exact"]
    elif level == EvidenceLevel.TECHNICAL_MEMORY:
        layers = ["technical_memory", "manual_family", "manual_exact"]
    elif level == EvidenceLevel.GRAPH_INTERNAL:
        layers = ["graph_internal", "technical_memory", "manual_family"]
    elif level == EvidenceLevel.OFFICIAL_WEB:
        layers = ["official_web", "graph_internal", "technical_memory"]
        if opts.allow_web:
            layers.insert(0, "web_search")
    elif level == EvidenceLevel.WEB_FALLBACK:
        layers = ["web_fallback", "official_web", "graph_internal"]
        if opts.allow_web:
            layers.insert(0, "web_search")
    elif level == EvidenceLevel.LLM_TRIAGE:
        layers = ["llm_triage", "technical_memory", "manual_family"]
    else:  # INSUFFICIENT_CONTEXT
        layers = ["llm_triage"]

    return layers


def _determine_answer_mode(level: EvidenceLevel, intake_result: dict[str, Any]) -> str:
    """Determine how the response should be formatted."""
    domain = intake_result.get("domain", "").lower()
    has_error_code = bool(intake_result.get("error_codes"))

    if level == EvidenceLevel.MANUAL_EXACT:
        return "manual_response"
    elif level == EvidenceLevel.MANUAL_FAMILY:
        return "family_response"
    elif level == EvidenceLevel.TECHNICAL_MEMORY:
        return "technical_response"
    elif level == EvidenceLevel.GRAPH_INTERNAL:
        return "diagnostic_hint"
    elif level == EvidenceLevel.OFFICIAL_WEB:
        return "web_cited_response"
    elif level == EvidenceLevel.WEB_FALLBACK:
        return "web_cited_response"
    elif level == EvidenceLevel.LLM_TRIAGE:
        if domain in ("electrical", "refrigerant", "compressors"):
            return "safety_first_triage"
        elif has_error_code:
            return "error_code_triage"
        else:
            return "symptom_triage"
    else:
        return "information_request"


def _build_source_citation(level: EvidenceLevel, intake_result: dict[str, Any]) -> Optional[str]:
    """Build internal source citation string (not user-facing)."""
    model = intake_result.get("equipment", {}).get("model", "")

    citations = {
        EvidenceLevel.MANUAL_EXACT: f"manual_exact:{model}" if model else "manual_exact",
        EvidenceLevel.MANUAL_FAMILY: f"manual_family:{model}" if model else "manual_family",
        EvidenceLevel.TECHNICAL_MEMORY: "memory:technical",
        EvidenceLevel.GRAPH_INTERNAL: "graph:internal",
        EvidenceLevel.OFFICIAL_WEB: "web:official",
        EvidenceLevel.WEB_FALLBACK: "web:fallback",
        EvidenceLevel.LLM_TRIAGE: "llm:minimax_safe",
    }

    return citations.get(level)


def _build_family_note(intake_result: dict[str, Any]) -> Optional[str]:
    """Build note about family model differences (internal only)."""
    equipment = intake_result.get("equipment", {})
    model = equipment.get("model", "")
    family = equipment.get("family", model)

    if model and family and model != family:
        return f"semelhante ao modelo {family}"
    return None


def _determine_blocked_values(level: EvidenceLevel, opts: ResolverOptions) -> list[str]:
    """
    Determine which technical value patterns to block.

    All technical values are blocked when evidence_level < manual_family.
    """
    if not opts.block_all_technical_values:
        return []

    if level in (EvidenceLevel.MANUAL_EXACT, EvidenceLevel.MANUAL_FAMILY):
        return []

    blocked = []
    for pattern in BLOCKED_VALUE_PATTERNS:
        blocked.append(pattern.pattern)

    return blocked


def _determine_next_question(level: EvidenceLevel, intake_result: dict[str, Any], cov: CoverageMap, opts: ResolverOptions) -> Optional[str]:
    """
    Determine if a follow-up question should be asked.

    Returns exactly ONE simple question or None.
    Never returns "I don't have the manual" — always follows triage path.
    """
    query = intake_result.get("query", "")
    symptoms = intake_result.get("symptoms", [])
    error_codes = intake_result.get("error_codes", [])

    # If insufficient context, always ask for more info.
    if level == EvidenceLevel.INSUFFICIENT_CONTEXT:
        if error_codes:
            return "Qual é o modelo exato da unidade?"
        elif symptoms and not error_codes:
            return "Qual é o modelo exato da unidade?"
        else:
            return "Você pode informar o modelo da unidade?"

    # For manual_family, ask to confirm if they have exact model.
    if level == EvidenceLevel.MANUAL_FAMILY:
        return "Esse modelo é exatamente o que você tem, ou é da mesma família?"

    # For llm_triage, ask targeted question based on symptoms.
    if level == EvidenceLevel.LLM_TRIAGE:
        if symptoms and not error_codes:
            return "Você tem acesso ao erro ou código de falhas?"
        elif error_codes and not symptoms:
            return "Quando o erro ocorre, o que você observa na unidade?"

    # For web search levels, ask to confirm model if missing.
    if level in (EvidenceLevel.OFFICIAL_WEB, EvidenceLevel.WEB_FALLBACK):
        equipment = intake_result.get("equipment", {})
        if not equipment.get("model"):
            return "Qual é o modelo exato da unidade?"

    return None


def _get_level_safety_flags(level: EvidenceLevel) -> list[str]:
    """Return mandatory safety flags for each evidence level."""
    flags_by_level = {
        EvidenceLevel.MANUAL_EXACT: [],
        EvidenceLevel.MANUAL_FAMILY: ["EPA_CERTIFICATION"],
        EvidenceLevel.TECHNICAL_MEMORY: ["EPA_CERTIFICATION"],
        EvidenceLevel.GRAPH_INTERNAL: ["HIGH_VOLTAGE", "EPA_CERTIFICATION"],
        EvidenceLevel.OFFICIAL_WEB: ["HIGH_VOLTAGE", "EPA_CERTIFICATION"],
        EvidenceLevel.WEB_FALLBACK: ["HIGH_VOLTAGE", "DC_BUS", "EPA_CERTIFICATION"],
        EvidenceLevel.LLM_TRIAGE: ["HIGH_VOLTAGE", "COMPRESSOR", "DC_BUS", "ENERGIZED_MEASUREMENT", "EPA_CERTIFICATION"],
        EvidenceLevel.INSUFFICIENT_CONTEXT: ["HIGH_VOLTAGE", "COMPRESSOR", "DC_BUS", "ENERGIZED_MEASUREMENT", "EPA_CERTIFICATION", "REFRIGERANT_PRESSURE"],
    }
    return flags_by_level.get(level, [])


def _build_provider_hints(level: EvidenceLevel, intake_result: dict[str, Any], cov: CoverageMap, opts: ResolverOptions) -> dict[str, Any]:
    """
    Build internal provider hints (never exposed to user).

    These are instructions for the caller about how to handle the response.
    """
    hints: dict[str, Any] = {
        "do_not_invent_values": True,
        "use_suppression_map": True,
    }

    if level == EvidenceLevel.MANUAL_EXACT:
        hints["response_type"] = "authoritative"
        hints["cite_source"] = "pelo manual"
        hints["confidence_override"] = 0.95

    elif level == EvidenceLevel.MANUAL_FAMILY:
        hints["response_type"] = "family_match"
        hints["cite_source"] = "pelo manual"
        hints["note_family_difference"] = True
        hints["confidence_override"] = 0.80

    elif level == EvidenceLevel.TECHNICAL_MEMORY:
        hints["response_type"] = "technical_memory"
        hints["cite_source"] = "pela memória técnica"
        hints["confidence_override"] = 0.70

    elif level == EvidenceLevel.GRAPH_INTERNAL:
        hints["response_type"] = "diagnostic_hint"
        hints["cite_source"] = "pela base técnica"
        hints["present_as_hint"] = True
        hints["confidence_override"] = 0.60

    elif level == EvidenceLevel.OFFICIAL_WEB:
        hints["response_type"] = "web_cited"
        hints["cite_source"] = "segundo a consulta externa"
        hints["trigger_search"] = "tavily"
        hints["confidence_override"] = 0.55

    elif level == EvidenceLevel.WEB_FALLBACK:
        hints["response_type"] = "web_fallback"
        hints["cite_source"] = "segundo a consulta externa"
        hints["trigger_search"] = "general"
        hints["note_confidence"] = True
        hints["confidence_override"] = 0.40

    elif level == EvidenceLevel.LLM_TRIAGE:
        hints["response_type"] = "safe_triage"
        hints["cite_source"] = "pela triagem técnica"
        hints["llm_provider"] = "minimax"
        hints["no_invented_values"] = True
        hints["confidence_override"] = 0.30

    else:  # INSUFFICIENT_CONTEXT
        hints["response_type"] = "information_request"
        hints["cite_source"] = None
        hints["always_ask_followup"] = True
        hints["confidence_override"] = 0.10

    # Add suppression map for output sanitization.
    hints["suppression_map"] = PUBLIC_SUBSTITUTIONS

    return hints


def _compute_confidence(level: EvidenceLevel, cov: CoverageMap) -> float:
    """Compute confidence score based on evidence level and coverage."""
    base_confidence = {
        EvidenceLevel.MANUAL_EXACT: 0.95,
        EvidenceLevel.MANUAL_FAMILY: 0.80,
        EvidenceLevel.TECHNICAL_MEMORY: 0.70,
        EvidenceLevel.GRAPH_INTERNAL: 0.60,
        EvidenceLevel.OFFICIAL_WEB: 0.55,
        EvidenceLevel.WEB_FALLBACK: 0.40,
        EvidenceLevel.LLM_TRIAGE: 0.30,
        EvidenceLevel.INSUFFICIENT_CONTEXT: 0.10,
    }

    base = base_confidence.get(level, 0.10)

    # Small boost if multiple sources in same level are available.
    same_level_sources = 0
    if level == EvidenceLevel.MANUAL_FAMILY and cov.manual_exact:
        same_level_sources += 1
    if level == EvidenceLevel.TECHNICAL_MEMORY and (cov.manual_family or cov.manual_exact):
        same_level_sources += 1

    boost = same_level_sources * 0.05
    return min(base + boost, 0.99)


def apply_suppression(text: str) -> str:
    """
    Apply suppression map to user-facing text.

    Replace internal/system terms with user-friendly alternatives.
    """
    result = text
    for internal_term, public_term in PUBLIC_SUBSTITUTIONS.items():
        # Case-insensitive replacement.
        pattern = re.compile(re.escape(internal_term), re.IGNORECASE)
        result = pattern.sub(public_term, result)
    return result


def is_safe_to_mention_technical_value(value: str, blocked_values: list[str]) -> bool:
    """
    Check if a technical value is safe to mention given blocked_values.

    Args:
        value: The technical value string to check.
        blocked_values: List of blocked regex patterns.

    Returns:
        True if the value can be mentioned, False if it should be suppressed.
    """
    if not blocked_values:
        return True

    for pattern in blocked_values:
        if re.search(pattern, value, re.IGNORECASE):
            return False

    return True


# Backwards compatibility alias.
resolve_hvac = resolve


if __name__ == "__main__":
    # Simple smoke test.
    test_intake = {
        "query": "erro E6 split 9000",
        "domain": "electrical",
        "equipment": {"model": "KS-09N", "family": "KS-N"},
        "symptoms": ["nãoliga"],
        "error_codes": ["E6"],
    }

    test_coverage = {
        "manual_exact": False,
        "manual_family": True,
        "technical_memory": False,
        "graph_internal": True,
        "official_web": False,
        "web_fallback": False,
        "llm_triage": True,
    }

    result = resolve(test_intake, test_coverage)
    print("Resolver result:", result)
    print("Answer mode:", result["answer_mode"])
    print("Context layers:", result["context_layers"])
    print("Safety flags:", result["safety_flags"])
