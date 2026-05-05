#!/usr/bin/env python3
"""
HVAC Friendly Response Rewriter

Polishes technical HVAC RAG responses into friendly, tutor-style
conversations — similar to how ChatGPT would respond.

Rules:
1. Remove internal evidence labels ("Graph interno", "Evidência: ...")
2. Replace technical jargon with accessible Portuguese
3. Limit response length (default: 600 chars, max: 900)
4. Ensure at most ONE question at the end
5. Never end with a safety disclaimer as the last line (move up if needed)
6. Keep a warm, patient, tutor voice

Usage:
    from hvac_friendly_response import rewrite_response
    friendly = rewrite_response(raw_response, user_query="preciso de ajuda em um vrv daikin")
"""

import re
from typing import Optional

DEFAULT_MAX_CHARS = 600
DEFAULT_MAX_CHARS_HARD = 900

# ---------------------------------------------------------------------------
# Rewrite rules — applied in order
# ---------------------------------------------------------------------------

# Pairs: (pattern, replacement) — pattern can be str or re.Pattern
_RewriteRule = tuple[str | re.Pattern[str], str]
REWRITE_RULES: list[_RewriteRule] = [
    # Remove evidence/source labels from middle of response
    (
        re.compile(r"Evidência:\s+Graph\s+interno", re.IGNORECASE),
        "Pela triagem técnica",
    ),
    (
        re.compile(r"Evidência:\s+", re.IGNORECASE),
        "",
    ),
    (
        re.compile(r"Fonte:\s+Graph\s+interno", re.IGNORECASE),
        "Pela base técnica",
    ),
    (
        re.compile(r"\[Trecho \d+\]\s*"),
        "",
    ),
    (
        re.compile(r"Trecho \d+[\|:]\s*"),
        "",
    ),
    # Replace dry procedural openers
    (
        "Para procedimento exato eu preciso casar isso com a unidade externa/interna correta.",
        "Para passo a passo com segurança, depois eu confiro o manual do modelo. Primeiro vamos achar o caminho do defeito.",
    ),
    (
        "Confirma uma coisa simples:",
        "Me manda só uma coisa:",
    ),
    (
        "Confirme uma coisa simples:",
        "Me manda só uma coisa:",
    ),
    # Simplify model request language
    (
        "forneça o MODELO COMPLETO",
        "me manda o modelo completo",
    ),
    (
        "Forneça o MODELO COMPLETO",
        "Me manda o modelo completo",
    ),
    (
        "Forneça o modelo completo",
        "Me manda o modelo completo",
    ),
    (
        "forneça o modelo completo",
        "me manda o modelo completo",
    ),
    (
        "Forneça o modelo completo",
        "Me manda o modelo completo",
    ),
    (
        "Por favor, forneça o modelo completo",
        "Me manda o modelo completo",
    ),
    (
        "Por favor me forneça o modelo completo",
        "Me manda o modelo completo",
    ),
    # Avoid repeating "modelo completo" multiple times
    (
        re.compile(r"modelo completo[\s\S]*?modelo completo", re.IGNORECASE),
        "modelo completo",
    ),
    # Fix "não encontrei no manual" dead ends
    (
        "não encontrei isso nos manuais indexados para este modelo.",
        "não encontrei isso nos manuais indexados — vou tratar como triagem técnica.",
    ),
    (
        "não encontrei informações relevantes nos manuais indexados.",
        "não encontrei esse procedimento nos manuais que tenho — vou te ajudar com o que sei.",
    ),
    # Replace "preciso casar" with friendly version
    (
        "Para isso eu preciso casar com a unidade externa e interna corretas.",
        "Para dar o passo a passo correto, depois eu confiro o manual do modelo.",
    ),
    # Improve error code ask format
    (
        "qual é o código de alarme ou modelo que aparece na etiqueta/display?",
        "o código que aparece no display? Pode ser algo como U4-01, E4-01 ou A3.",
    ),
    (
        "qual é o código de alarme ou modelo que aparece na etiqueta/display",
        "o código que aparece no display? Pode ser algo como U4-01, E4-01 ou A3.",
    ),
    # Clean up double/newline noise
    (
        re.compile(r"\n{3,}"),
        "\n\n",
    ),
    (
        re.compile(r"^\s+\n", re.MULTILINE),
        "",
    ),
]

# Phrases that signal the response is a dead end — patch to add fallback
DEAD_END_PATTERNS = [
    re.compile(r"não encontrei isso nos manuais indexados", re.IGNORECASE),
    re.compile(r"não há informações suficientes para", re.IGNORECASE),
    re.compile(r"preciso do modelo completo para", re.IGNORECASE),
]

# Phrases that signal a good ending (natural question or soft close)
GOOD_END_PATTERNS = [
    re.compile(r"\?$"),
    re.compile(r"—?\s*$"),
]

# One question only — truncate everything after the first "?"
QUESTION_TRUNCATE = re.compile(r"\?(.+)")

# Strip markdown headers and bold from response
MARKDOWN_CLEANUP = [
    (re.compile(r"\*\*(.+?)\*\*"), r"\1"),
    (re.compile(r"\*(.+?)\*"), r"\1"),
    (re.compile(r"^#+\s+", re.MULTILINE), ""),
    (re.compile(r"^---\s*$", re.MULTILINE), ""),
]


def _apply_rules(text: str) -> str:
    """Apply all rewrite rules in sequence (supports both str and regex patterns)."""
    for old, new in REWRITE_RULES:
        if isinstance(old, re.Pattern):
            text = old.sub(new, text)
        else:
            text = text.replace(old, new)
    return text


def _cleanup_markdown(text: str) -> str:
    """Remove markdown artifacts."""
    for pattern, replacement in MARKDOWN_CLEANUP:
        text = pattern.sub(replacement, text)
    return text


def _count_questions(text: str) -> int:
    """Count question marks in text."""
    return text.count("?")


def _enforce_one_question(text: str) -> str:
    """Ensure at most one question; if more, keep only the last one."""
    count = _count_questions(text)
    if count <= 1:
        return text

    # Split by '?', reconstruct: intro (before first '?') + last '?'
    # For "Q1?\nQ2?" → raw_parts=["Q1","\nQ2",""], want intro="Q1", last_q="Q2"
    raw_parts = text.split("?")
    if len(raw_parts) <= 2:
        return text

    intro = raw_parts[0].rstrip()
    # Last question is in raw_parts[-2] (text after last '?' is raw_parts[-1]="")
    last_q_text = raw_parts[-2].strip()
    return f"{intro}\n\n{last_q_text}?"


def _trim_to_max(text: str, max_chars: int = DEFAULT_MAX_CHARS_HARD) -> str:
    """Hard cap at max_chars, breaking at sentence boundary when possible."""
    if len(text) <= max_chars:
        return text

    # Try to cut at sentence boundary (~. ! or \n)
    cutoff = text[:max_chars]
    # Find last sentence boundary
    for sep in (". ", "!\n", "?\n", "\n\n", "\n"):
        pos = cutoff.rfind(sep)
        if pos > max_chars * 0.6:
            return text[:pos + len(sep)].strip()

    # Fallback: hard cut
    return text[:max_chars].rstrip() + "…"


def _patch_dead_end(text: str) -> str:
    """If response is a dead end, append a helpful follow-up."""
    for pattern in DEAD_END_PATTERNS:
        if pattern.search(text):
            # Don't overwrite — append a friendly follow-up if there isn't one
            if not any(p.search(text) for p in GOOD_END_PATTERNS):
                text = text.rstrip() + (
                    "\n\nMe manda o que aparece no display ou na etiqueta da unidade? "
                    "Com isso eu consigo ser mais preciso."
                )
            break
    return text


def rewrite_response(raw_response: str, user_query: str = "",
                     max_chars: int = DEFAULT_MAX_CHARS) -> str:
    """
    Rewrite a raw HVAC technical response into a friendly tutor response.

    Args:
        raw_response: The raw text from the LLM.
        user_query: Optional original user query (used for context).
        max_chars: Soft limit — responses longer than this get trimmed
                   to the nearest sentence boundary. Hard cap is always 900.

    Returns:
        Friendly, tutor-style response string.
    """
    if not raw_response or not raw_response.strip():
        return ""

    text = raw_response.strip()

    # Step 1: Remove markdown artifacts
    text = _cleanup_markdown(text)

    # Step 2: Apply rewrite rules
    text = _apply_rules(text)

    # Step 3: Patch dead ends
    text = _patch_dead_end(text)

    # Step 4: Enforce one question maximum
    text = _enforce_one_question(text)

    # Step 5: Soft trim
    if len(text) > max_chars:
        text = _trim_to_max(text, DEFAULT_MAX_CHARS_HARD)

    # Step 6: Final cleanup — strip trailing whitespace and normalize newlines
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = text.strip()

    return text


# ---------------------------------------------------------------------------
# Convenience wrappers for specific query types
# ---------------------------------------------------------------------------

def rewrite_triage_response(raw: str, error_code: str = "") -> str:
    """Rewrite a guided triage response with error-code context."""
    friendly = rewrite_response(raw)
    if error_code and not error_code.lower() in friendly.lower():
        # Error code is important — surface it naturally
        friendly = friendly.replace(
            "o código que aparece no display",
            f"o {error_code} que aparece no display",
        )
    return friendly


def rewrite_field_response(raw: str) -> str:
    """Rewrite a field technician response — slightly more technical."""
    # Field tutor responses can be a bit longer but still friendly
    return rewrite_response(raw, max_chars=800)


def rewrite_blocked_response() -> str:
    """Friendly out-of-domain blocked message."""
    return (
        "Esta base é especializada em ar-condicionado, climatização e refrigeração. "
        "Posso te ajudar com dúvidas sobre split, VRV, erros como U4, E4, ou "
        "procedimentos de manutenção em equipamentos HVAC. Me conta o que precisa!"
    )


def rewrite_ask_clarification_response(has_safety: bool = False,
                                       partial_info: str = "") -> str:
    """Friendly ask-for-model message."""
    if has_safety:
        return (
            "Para te ajudar com segurança, preciso entender melhor o cenário.\n\n"
            "⚠️ Antes de mexer em algo com alta tensão (placa, IPM, compressor):\n"
            "1. Desliga da tomada\n"
            "2. Espera o tempo do manual\n"
            "3. Mede com multímetro se não tiver tensão\n\n"
            "Me manda o que aparece no display ou na etiqueta da unidade?\n"
            "Exemplo: algo como U4-01, E4-01, A3, ou um código de modelo como RXYQ20BRA."
        )

    if partial_info:
        return (
            f"Entendi — {partial_info}.\n\n"
            "Para eu dar o próximo passo com segurança, me manda só uma coisa:\n"
            "o que aparece no display ou na etiqueta da unidade?\n"
            "Exemplo: um código como U4-01, E4-01 ou um modelo como RXQ20AYM."
        )

    return (
        "Para te ajudar melhor, me manda só uma coisa:\n"
        "o que aparece no display ou na etiqueta da unidade?\n"
        "Exemplo: um código como U4-01, E4-01 ou um modelo como RXYQ20BRA."
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys, json

    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Run built-in rewrite tests
        TESTS = [
            # (input, expected_keyword_in_output, description)
            (
                "Evidência: Graph interno\nConfirma uma coisa simples: qual é o código de alarme?",
                "triagem",
                "Graph interno → triagem técnica",
            ),
            (
                "Para procedimento exato eu preciso casar isso com a unidade externa/interna correta.",
                "passo a passo com segurança",
                "procedural → friendly",
            ),
            (
                "Confirma uma coisa simples: forneça o MODELO COMPLETO",
                "Me manda o modelo completo",
                "dry ask → friendly ask",
            ),
            (
                "não encontrei isso nos manuais indexados para este modelo.",
                "triagem técnica",
                "dead end → friendly fallback",
            ),
        ]

        passed = failed = 0
        for raw, keyword, desc in TESTS:
            result = rewrite_response(raw)
            if keyword.lower() in result.lower():
                print(f"  PASS: {desc}")
                print(f"    Input:  {raw[:60]}...")
                print(f"    Output: {result[:80]}...")
                passed += 1
            else:
                print(f"  FAIL: {desc}")
                print(f"    Input:  {raw}")
                print(f"    Output: {result}")
                failed += 1

        print(f"\n{passed}/{passed+failed} rewrite rules passed")
        sys.exit(0 if failed == 0 else 1)

    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            raw = f.read()
        print(rewrite_response(raw))
    else:
        print("Usage: python hvac-friendly-response.py [--test] [file]")
