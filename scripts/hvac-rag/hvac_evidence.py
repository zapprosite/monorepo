"""
HVAC Evidence Layer Definitions

Provides evidence level management for the HVAC universal resolver RAG system.
Each evidence level defines confidence, safety tolerance, and value restrictions
for technical content retrieved from different sources.
"""

from typing import Any


EVIDENCE_LEVELS: dict[str, dict[str, Any]] = {
    "manual_exact": {
        "display_label": "Manual de serviço exato",
        "confidence": 0.95,
        "safety_tolerance": "full",
        "value_restriction": "none",
        "can_invent_values": False,
        "can_measure_energized": True,
        "requires_manual_cite": True,
    },
    "manual_family": {
        "display_label": "Manual da família",
        "confidence": 0.75,
        "safety_tolerance": "medium",
        "value_restriction": "family_typical",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_manual_cite": True,
    },
    "technical_memory": {
        "display_label": "Memória técnica",
        "confidence": 0.70,
        "safety_tolerance": "low",
        "value_restriction": "ranges_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_relato_cite": True,
    },
    "graph_internal": {
        "display_label": "Base interna",
        "confidence": 0.60,
        "safety_tolerance": "low",
        "value_restriction": "paths_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_graph_cite": True,
    },
    "official_web": {
        "display_label": "Busca oficial externa",
        "confidence": 0.65,
        "safety_tolerance": "medium",
        "value_restriction": "cited_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_source_cite": True,
    },
    "web_fallback": {
        "display_label": "Busca externa",
        "confidence": 0.45,
        "safety_tolerance": "low",
        "value_restriction": "general_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_source_cite": True,
    },
    "llm_triage": {
        "display_label": "Triagem técnica",
        "confidence": 0.40,
        "safety_tolerance": "low",
        "value_restriction": "paths_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_triage_label": True,
    },
    "insufficient_context": {
        "display_label": "Contexto insuficiente",
        "confidence": 0.10,
        "safety_tolerance": "none",
        "value_restriction": "safety_only",
        "can_invent_values": False,
        "can_measure_energized": False,
        "requires_more_info": True,
    },
}

# Technical value patterns that require evidence level validation
TECHNICAL_VALUE_PATTERNS: list[str] = [
    r"\d+\s*[VVAOhmΩΩΩΩ]",
    r"\d+\.\d+\s*[VVAOhmΩ]",
    r"\d+\s*bar",
    r"\d+\s*psi",
    r"\d+\s*BTU",
    r"\d+\s*Hz",
    r"\d+\s*RPM",
    r"\d+\s*C\b",
    r"\d+\s*kPa",
    r"\d+\s*kW",
    r"\d+\s*W",
    r"\d+\s*kWh",
    r"\d+\s*F\b",
]

# Evidence levels that allow specific numeric values (above family_typical)
VALUE_PERMISSIVE_LEVELS: set[str] = {"manual_exact", "manual_family"}

# Evidence levels that allow only ranges
RANGES_ONLY_LEVELS: set[str] = {"technical_memory", "llm_triage"}

# Evidence levels that allow only paths/diagnostics, no values
PATHS_ONLY_LEVELS: set[str] = {"graph_internal"}

# Evidence levels that allow only cited values from source
CITED_ONLY_LEVELS: set[str] = {"official_web"}

# Evidence levels that allow only general HVAC knowledge
GENERAL_ONLY_LEVELS: set[str] = {"web_fallback"}

# Evidence levels that allow only safety info
SAFETY_ONLY_LEVELS: set[str] = {"insufficient_context"}

# Safety-only levels that block all technical values
FULL_BLOCK_LEVELS: set[str] = {"insufficient_context", "llm_triage", "web_fallback", "graph_internal"}

# Value placeholders for different restriction levels
VALUE_PLACEHOLDERS: dict[str, str] = {
    "manual_exact": "conforme manual e seção citada",
    "manual_family": "valor típico da família (conferir etiqueta)",
    "family_typical": "valor típico (conferir etiqueta do equipamento)",
    "ranges_only": "faixa típica do fabricante",
    "paths_only": "conforme procedimento de diagnóstico",
    "cited_only": "conforme fonte citada",
    "general_only": "valor genérico HVAC",
    "safety_only": "informação de segurança apenas",
}


def get_evidence_level(level_name: str) -> dict[str, Any]:
    """
    Get the full definition for an evidence level.

    Args:
        level_name: The evidence level identifier (e.g., 'manual_exact')

    Returns:
        Dictionary containing the level definition with all properties

    Raises:
        KeyError: If level_name is not a valid evidence level
    """
    if level_name not in EVIDENCE_LEVELS:
        raise KeyError(
            f"Unknown evidence level: '{level_name}'. "
            f"Valid levels: {list(EVIDENCE_LEVELS.keys())}"
        )
    return EVIDENCE_LEVELS[level_name].copy()


def get_safe_value_threshold(evidence_level: str) -> str:
    """
    Get the safe value threshold description for an evidence level.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        Human-readable description of what values are safe to mention
    """
    level = get_evidence_level(evidence_level)
    restriction = level.get("value_restriction", "safety_only")

    return VALUE_PLACEHOLDERS.get(
        restriction,
        "valor não especificado - consultar manual"
    )


def should_block_values(evidence_level: str, proposed_value: str) -> bool:
    """
    Determine if a proposed technical value should be blocked.

    Args:
        evidence_level: The evidence level identifier
        proposed_value: The value being proposed (e.g., '220V', '3.5 bar')

    Returns:
        True if the value should be blocked, False if it can be used
    """
    import re

    level = get_evidence_level(evidence_level)

    # Check if this level can invent values at all
    if level.get("can_invent_values", False):
        return False

    # Full block levels always block
    if evidence_level in FULL_BLOCK_LEVELS:
        return True

    # Check if the proposed value matches technical value patterns
    is_technical_value = any(
        re.search(pattern, proposed_value, re.IGNORECASE)
        for pattern in TECHNICAL_VALUE_PATTERNS
    )

    if not is_technical_value:
        return False

    # For technical values, check against value_restriction
    restriction = level.get("value_restriction", "paths_only")

    if restriction in ("none",):
        return False

    if restriction in ("family_typical", "cited_only"):
        return False

    if restriction in ("ranges_only",):
        # Allow ranges like "2-4 bar" but not exact values
        is_range = bool(re.search(r"\d+\s*-\s*\d+", proposed_value))
        return not is_range

    if restriction in ("paths_only", "general_only", "safety_only"):
        return True

    return True


def format_evidence_label(evidence_level: str) -> str:
    """
    Format the evidence level as a human-readable label.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        Human-readable label for display in UI/responses
    """
    level = get_evidence_level(evidence_level)
    return level.get("display_label", evidence_level)


def get_next_question_prompt(coverage_map: dict, evidence_level: str) -> str:
    """
    Generate a prompt for what information to ask next based on coverage gaps.

    Args:
        coverage_map: Dictionary mapping domain/topic to coverage status
                      e.g., {"refrigerant": True, "electrical": False, " airflow": False}
        evidence_level: The current evidence level being used

    Returns:
        A prompt string guiding what additional information to collect
    """
    level = get_evidence_level(evidence_level)
    restriction = level.get("value_restriction", "safety_only")

    uncovered = [topic for topic, covered in coverage_map.items() if not covered]

    if not uncovered:
        return "Informações suficientes coletadas. Proceder com diagnóstico."

    prompts_by_restriction: dict[str, str] = {
        "none": (
            " Coletar informações do manual de serviço: "
            "modelo exato, número de série, valores de Nameplate (V/A/Hz), "
            "pressões de trabalho, temperaturas de descarga/retorno, "
            "e seção específica do manual com os valores de referência."
        ),
        "family_typical": (
            " Solicitar etiqueta do equipamento (Nameplate) com valores de V/A/Hz, "
            "tipo de refrigerante, e ano de fabricação para identificar a família."
        ),
        "ranges_only": (
            " Solicitar faixa de valores esperada (ex: 2-4 bar, 5-10 A) "
            "ou procedimento de medição segura para os tópicos sem cobertura: "
            f"{', '.join(uncovered)}."
        ),
        "paths_only": (
            " Solicitar procedimento de diagnóstico ou fluxo de decisão "
            "para os tópicos sem cobertura: "
            f"{', '.join(uncovered)}. "
            "Não solicitar valores específicos."
        ),
        "cited_only": (
            " Solicitar fonte oficial (manual, catálogo, Ficha de Dados de Segurança) "
            "para os tópicos sem cobertura: "
            f"{', '.join(uncovered)}."
        ),
        "general_only": (
            " Para os tópicos sem cobertura: "
            f"{', '.join(uncovered)}, "
            "fornecer apenas orientações gerais de HVAC e procedimentos de segurança."
        ),
        "safety_only": (
            "AVISO: Contexto insuficiente para diagnóstico. "
            "Solicitar informações básicas do equipamento: "
            "modelo, sintoma principal, e condições de operação. "
            "Priorizar perguntas de segurança antes de qualquer medição."
        ),
    }

    return prompts_by_restriction.get(
        restriction,
        f" Solicitar mais informações sobre: {', '.join(uncovered)}."
    )


def get_confidence_boost(evidence_level: str, has_manual_cite: bool = False) -> float:
    """
    Calculate confidence adjustment based on citation quality.

    Args:
        evidence_level: The evidence level identifier
        has_manual_cite: Whether a specific manual section was cited

    Returns:
        Adjusted confidence multiplier (0.0 to 1.5)
    """
    level = get_evidence_level(evidence_level)
    base_confidence = level.get("confidence", 0.0)

    if evidence_level == "manual_exact" and has_manual_cite:
        return min(base_confidence * 1.05, 1.0)

    if evidence_level == "manual_family" and has_manual_cite:
        return base_confidence * 1.02

    if level.get("requires_manual_cite") and not has_manual_cite:
        return base_confidence * 0.85

    return base_confidence


def is_value_safe_to_display(
    evidence_level: str,
    value: str,
    unit: str | None = None
) -> tuple[bool, str]:
    """
    Check if a value is safe to display and provide replacement guidance.

    Args:
        evidence_level: The evidence level identifier
        value: The value to check (e.g., '220V', '3.5 bar')
        unit: Optional specific unit to validate

    Returns:
        Tuple of (is_safe, replacement_text)
    """
    import re

    if not should_block_values(evidence_level, value):
        return True, value

    level = get_evidence_level(evidence_level)
    restriction = level.get("value_restriction", "safety_only")

    placeholder = VALUE_PLACEHOLDERS.get(restriction, "valor não disponível")

    if unit:
        return False, f"valor conforme {unit} do equipamento ({placeholder})"

    return False, placeholder


def get_safety_tolerance_level(evidence_level: str) -> str:
    """
    Get the safety tolerance level for an evidence level.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        Safety tolerance level: 'full', 'medium', 'low', or 'none'
    """
    level = get_evidence_level(evidence_level)
    return level.get("safety_tolerance", "none")


def can_provide_technical_values(evidence_level: str) -> bool:
    """
    Check if an evidence level can provide any technical values.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        True if technical values can be provided at all
    """
    return evidence_level in VALUE_PERMISSIVE_LEVELS


def can_measure_energized(evidence_level: str) -> bool:
    """
    Check if measurements can be taken on energized equipment.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        True if energized measurements are permitted
    """
    level = get_evidence_level(evidence_level)
    return level.get("can_measure_energized", False)


def requires_citation(evidence_level: str) -> bool:
    """
    Check if an evidence level requires source citation.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        True if citation is required
    """
    level = get_evidence_level(evidence_level)
    return any(
        level.get(req, False)
        for req in [
            "requires_manual_cite",
            "requires_relato_cite",
            "requires_graph_cite",
            "requires_source_cite",
            "requires_triage_label",
        ]
    )


def get_required_citation_type(evidence_level: str) -> str | None:
    """
    Get the type of citation required for an evidence level.

    Args:
        evidence_level: The evidence level identifier

    Returns:
        Citation type string or None if not required
    """
    level = get_evidence_level(evidence_level)

    citation_fields = [
        ("requires_manual_cite", "manual"),
        ("requires_relato_cite", "relato"),
        ("requires_graph_cite", "base_interna"),
        ("requires_source_cite", "fonte"),
        ("requires_triage_label", "triagem"),
    ]

    for field, citation_type in citation_fields:
        if level.get(field, False):
            return citation_type

    return None


def get_all_evidence_levels() -> list[str]:
    """
    Get list of all available evidence level identifiers.

    Returns:
        List of evidence level names
    """
    return list(EVIDENCE_LEVELS.keys())


def get_evidence_level_summary() -> dict[str, dict[str, Any]]:
    """
    Get summary of all evidence levels with key properties.

    Returns:
        Dictionary mapping level names to their key properties
    """
    return {
        name: {
            "display_label": props["display_label"],
            "confidence": props["confidence"],
            "safety_tolerance": props["safety_tolerance"],
            "value_restriction": props["value_restriction"],
        }
        for name, props in EVIDENCE_LEVELS.items()
    }
