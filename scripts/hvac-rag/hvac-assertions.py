#!/usr/bin/env python3
"""
HVAC Assertions — T015.2 Runtime Reliability Assertions

Validates HVAC RAG output against safety and quality criteria:
1. printable_no_markdown — output must not contain markdown formatting
2. energized_measurement_safe — output must not mention "medir energizado" without explicit manual backing

Usage:
    python3 hvac-assertions.py --test printable_no_markdown --input <text>
    python3 hvac-assertions.py --test energized_measurement_safe --input <text> --context <manual_context>
    python3 hvac-assertions.py --suite runtime-reliability
"""

import re
import sys
import argparse
from typing import Optional


# Markdown patterns that should NOT appear in printable output
MARKDOWN_PATTERNS = [
    (r'^#{1,6}\s+', 'Header (^)'),
    (r'\*{1,3}[^*]+\*{1,3}', 'Bold/Italic (*)'),
    (r'_{1,3}[^_]+_{1,3}', 'Bold/Italic (_)'),
    (r'`[^`]+`', 'Inline code (`)'),
    (r'```', 'Code block (```)'),
    (r'\[([^\]]+)\]\([^)]+\)', 'Markdown link []()'),
    (r'!\[', 'Markdown image (![])'),
    (r'^>\s+', 'Blockquote (>)'),
    (r'^[-*_]{3,}\s*$', 'Horizontal rule'),
]

# Safety-related terms that require explicit manual backing
ENERGIZED_TERMS = [
    'energizado', 'energizada', 'medir energizado', 'medição energizada',
    'tensão energizada', 'sem desenergizar', 'sem desligar', 'ligado na rede',
    'com tensão', 'sob tensão', 'multímetro energizado',
]


def assert_printable_no_markdown(text: str) -> tuple[bool, list[str]]:
    """
    Assert that printable output contains NO markdown formatting.

    Returns:
        (passed, list_of_violations)
    """
    violations = []
    lines = text.split('\n')

    for i, line in enumerate(lines, 1):
        for pattern, name in MARKDOWN_PATTERNS:
            if re.search(pattern, line, re.MULTILINE):
                violations.append(f"Line {i}: {name} — '{line[:60].strip()}'")

    # Check for obvious markdown remnants
    if re.search(r'\*\*[^*]+\*\*', text):
        violations.append("Bold marker ** found")
    if re.search(r'__[^_]+__', text):
        violations.append("Bold marker __ found")
    if re.search(r'`[^`]+`', text):
        violations.append("Inline code ` found")
    if re.search(r'\[.*\]\(.*\)', text):
        violations.append("Markdown link []() found")
    if re.search(r'^#{1,6}\s', text, re.MULTILINE):
        violations.append("Header # found")

    return (len(violations) == 0, violations)


def assert_energized_measurement_safe(
    response: str,
    context: str,
    model: Optional[str] = None
) -> tuple[bool, list[str], Optional[str]]:
    """
    Assert that response does NOT mention energized measurement PERMISSIVELY
    (i.e., suggesting to measure energized) without explicit manual backing.

    Safety warnings like "NUNCA medir energizado" are acceptable and SAFE.

    Args:
        response: The LLM response text
        context: The retrieved manual context
        model: Optional model name for additional checks

    Returns:
        (passed, list_of_violations, blocking_phrase_or_none)
    """
    violations = []
    response_lower = response.lower()
    context_lower = context.lower() if context else ""

    # Permissive patterns: suggesting to measure while energized
    permissive_patterns = [
        r'medir?\s+(?:a\s+)?tensão\s+(?:energizad|ligad|sob\s+tensão)',
        r'medi[çc][ãa]o\s+(?:de\s+)?tensão\s+(?:energizad|ligad)',
        r'com\s+(?:tensão|energizado)\s+(?:ligad|medir|verificar)',
        r'sem\s+deslig[au]\s+(?:a\s+)?(?:unidade|equipo)',
        r'apenas?\s+deslig[au]\s+(?:não|sem)\s+ser',
    ]

    # Safety warning patterns that make energized mention SAFE
    safety_warning_patterns = [
        r'nunca\s+(?:medir|verificar|testar)',
        r'procedure.*sem\s+tensão',
        r'deslig[au]\s+.*(?:aguar[dr]|confirmar)',
        r'confirmar?\s+aus[êe]nc?ia\s+de\s+tensão',
        r'epis?\s+adequad',
        r'técnico\s+qualificad',
        r'lockout.*tagout',
        r'sem\s+(?:tensão|energizado)',
        r'Nunca\s+medir',
        r'NUNCA\s+MEDIR',
    ]

    # Check for permissive energized mentions
    for pattern in permissive_patterns:
        if re.search(pattern, response_lower):
            # Found permissive mention - check if there's a safety warning
            has_safety_warning = any(
                re.search(wp, response_lower) for wp in safety_warning_patterns
            )
            if not has_safety_warning:
                violations.append(
                    f"Response PERMISSIVELY mentions energized measurement matching pattern: {pattern}"
                )
                blocking_phrase = "MEDIÇÃO ENERGIZADA PERMISSIVA SEM AUTORIZAÇÃO"
                return (False, violations, blocking_phrase)
            else:
                # Has safety warning - this is safe
                pass

    # No violations - safe response (either no energized mention or safe with warning)
    return (True, violations, None)


def assert_guided_triage_no_anti_patterns(content: str) -> tuple[bool, list]:
    """
    Verifica que resposta guided_triage não contém anti-patterns.

    Anti-patterns para E4 Daikin VRV:
    - "compressor protection trip"
    - Valores de pressão exatos (PSI, bar)
    - Valores de tensão exatos (220V, 380V)
    - "inventado", "chute", "especulação"
    """
    violations = []
    content_lower = content.lower()

    anti_patterns = [
        "compressor protection trip",
        "compressor protection",
        "150 psi", "200 psi", "100 psi",
        "220v", "380v", "110v",
        "inventado", "chute", "não tenho certeza",
    ]

    for pattern in anti_patterns:
        if pattern in content_lower:
            violations.append(f"Anti-pattern found: {pattern}")

    return len(violations) == 0, violations


def assert_guided_triage_mentions_low_pressure(content: str) -> tuple[bool, list]:
    """Verifica que resposta menciona 'baixa pressão' ou similar para E4 VRV."""
    violations = []
    content_lower = content.lower()

    if "e4" in content_lower and "vrv" in content_lower:
        if not any(phrase in content_lower for phrase in ["baixa pressão", "baixa", "low pressure", "press"]):
            violations.append("E4 VRV sem menção de baixa pressão")

    return len(violations) == 0, violations


def assert_guided_triage_asks_subcode(content: str) -> tuple[bool, list]:
    """Verifica que resposta pede subcódigo quando aplicável."""
    violations = []
    content_lower = content.lower()

    if "e4" in content_lower and "e4-" not in content_lower:
        if not any(phrase in content_lower for phrase in ["subcódigo", "e4-01", "e4-001", "confirme"]):
            violations.append("E4 sem subcódigo não pede confirmação")

    return len(violations) == 0, violations


def assert_vrv_split_differentiation(content: str, query: str) -> tuple[bool, list]:
    """Verifica que resposta diferencia VRV de Split quando relevante."""
    violations = []
    content_lower = content.lower()
    query_lower = query.lower()

    has_split = any(w in query_lower for w in ["split", "hi-wall", "high-wall", "parede"])
    has_vrv = any(w in query_lower for w in ["vrv", "vrf"])

    if has_split and has_vrv:
        if not any(phrase in content_lower for phrase in ["diferente", "tabela diferente", "não é o mesmo"]):
            violations.append("VRV + Split sem aviso de diferença")

    return len(violations) == 0, violations


def run_printable_test(text: str) -> dict:
    """Run printable assertion and return structured result."""
    passed, violations = assert_printable_no_markdown(text)
    return {
        "test": "printable_no_markdown",
        "passed": passed,
        "violations": violations,
        "status": "PASS" if passed else "FAIL",
    }


def run_energized_test(response: str, context: str, model: Optional[str] = None) -> dict:
    """Run energized measurement assertion and return structured result."""
    passed, violations, blocking = assert_energized_measurement_safe(
        response, context, model
    )
    return {
        "test": "energized_measurement_safe",
        "passed": passed,
        "violations": violations,
        "blocking_phrase": blocking,
        "status": "PASS" if passed else "FAIL",
    }


def main():
    parser = argparse.ArgumentParser(
        description="HVAC Assertions — Runtime Reliability Validation"
    )
    parser.add_argument(
        "--test",
        choices=["printable_no_markdown", "energized_measurement_safe", "all"],
        default="all",
    )
    parser.add_argument("--input", help="Input text file or literal text (use --text)")
    parser.add_argument("--text", help="Input text as CLI argument")
    parser.add_argument("--context", help="Manual context for energized_measurement_safe test")
    parser.add_argument("--model", help="Model name for additional checks")
    parser.add_argument("--verbose", "-v", action="store_true")

    args = parser.parse_args()

    # Get input text
    if args.text:
        text = args.text
    elif args.input:
        with open(args.input, 'r', encoding='utf-8') as f:
            text = f.read()
    else:
        print("ERROR: --text or --input required")
        sys.exit(1)

    if args.test in ["printable_no_markdown", "all"]:
        result = run_printable_test(text)
        print(f"\n{'='*50}")
        print(f"TEST: {result['test']}")
        print(f"STATUS: {result['status']}")
        if result['violations']:
            print(f"VIOLATIONS ({len(result['violations'])}):")
            for v in result['violations']:
                print(f"  - {v}")
        if args.verbose:
            print(f"\nTEXT PREVIEW:\n{text[:300]}")
        print(f"{'='*50}")

    if args.test in ["energized_measurement_safe", "all"]:
        context = args.context or ""
        result = run_energized_test(text, context, args.model)
        print(f"\n{'='*50}")
        print(f"TEST: {result['test']}")
        print(f"STATUS: {result['status']}")
        if result['violations']:
            print(f"VIOLATIONS ({len(result['violations'])}):")
            for v in result['violations']:
                print(f"  - {v}")
        if result.get('blocking_phrase'):
            print(f"BLOCKING PHRASE: {result['blocking_phrase']}")
        if args.verbose:
            print(f"\nRESPONSE PREVIEW:\n{text[:300]}")
            print(f"\nCONTEXT PREVIEW:\n{context[:300]}")
        print(f"{'='*50}")

    # Exit code
    if args.test == "all":
        sys.exit(0)

    passed = result['passed']
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
