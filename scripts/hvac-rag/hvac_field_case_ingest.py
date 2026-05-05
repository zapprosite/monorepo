"""
HVAC Field Case Ingest Pipeline — /ensinar text pipeline.
Receives free-text field experience input, extracts case card,
saves to Postgres, and (after approval) indexes to Qdrant.
"""

import os
import sys
import re
import json
import argparse
from datetime import datetime
from typing import Optional

sys.path.insert(0, os.path.dirname(__file__))
from hvac_field_memory import (
    insert_field_case,
    approve_field_case,
    index_field_case_approved,
    list_field_cases,
    get_field_case,
)

# ---------------------------------------------------------------------------
# Keyword sets for heuristic extraction
# ---------------------------------------------------------------------------
BRAND_KEYWORDS = [
    "daikin", "springer", "midea", "carrier", "york", "lennox",
    "mitsubishi", "lg", "samsung", "hitachi", "gree", "panasonic",
    "electrolux", "bgh", "philco", "consul",
]
ALARM_CODE_PATTERN = re.compile(
    r"\b([A-Z][0-9]{1,4}(?:-[0-9]{2,4})?)\b"
)
COMPONENT_KEYWORDS = [
    "vee", "compressor", "ipm", "placa", "condensador", "evaporador",
    "unidade interna", "unidade externa", "linha de liquido", "linha liquido",
    "valvula", "expansao", "filtro", "sensor", "pressor",
    "inversor", "drive", "placa principal", "placa de potencia",
    "capacitor", "motor", "ventilador", "serpentina", "turbina",
]
EQUIPMENT_KEYWORDS = [
    "vrv", "vrf", "split", "janela", "cassete", "piso teto",
    "hi-wall", "high wall", "console", "precis", "compacta",
    "multi-split", "duty", "chiller", " package",
]
SYMPTOM_KEYWORDS = [
    "nao liga", "nao esquenta", "nao gela", "nao frio", "nao ventila",
    "desliga", "desliga sozinho", "reinicia", "bip", "erro",
    "vazamento", "ruido", "vibracao", "super aquecimento", "baixa pressao",
    "alta pressao", "falha", "bloqueio", "compressor travado",
    "queda de capacidade", "gelo", "condensacao", "pingo",
]


def _normalize(text: str) -> str:
    return text.lower()


def _find_all(text: str, keywords: list[str]) -> list[str]:
    norm = _normalize(text)
    found = []
    for kw in keywords:
        if kw.lower() in norm:
            found.append(kw)
    return found


def _extract_alarm_codes(text: str) -> list[str]:
    return list(set(ALARM_CODE_PATTERN.findall(text.upper())))


def _extract_symptoms(text: str) -> list[str]:
    return _find_all(text, SYMPTOM_KEYWORDS)


def _split_paragraphs(text: str) -> list[str]:
    """Split on double newlines or single newlines followed by capital letter."""
    parts = re.split(r"\n\n+|\n(?=[A-Z])", text.strip())
    return [p.strip() for p in parts if p.strip()]


def extract_case_card_from_text(text: str, author: str) -> dict:
    """
    Extract a case card from free-form field text using heuristics.
    No LLM call — keyword + regex extraction only.
    """
    text = text.strip()
    norm = _normalize(text)

    # Brand detection
    brands_found = _find_all(text, BRAND_KEYWORDS)
    brand = brands_found[0].title() if brands_found else None

    # Equipment type
    equip_found = _find_all(text, EQUIPMENT_KEYWORDS)
    equipment_type = equip_found[0].upper() if equip_found else "HVAC"

    # Alarm codes
    alarm_codes = _extract_alarm_codes(text)

    # Components
    components = _find_all(text, COMPONENT_KEYWORDS)

    # Symptoms
    symptoms = _extract_symptoms(text)

    # Paragraphs for problem_summary / field_technique
    paragraphs = _split_paragraphs(text)

    # Simple heuristic: first paragraph = problem, remaining = technique
    if len(paragraphs) >= 1:
        problem_summary = paragraphs[0]
    else:
        problem_summary = text[:500] if len(text) > 500 else text

    if len(paragraphs) > 1:
        field_technique = "\n".join(paragraphs[1:])
    else:
        field_technique = None

    # Extract model (generic pattern like "KXG001" or "AD280")
    model_match = re.search(
        r"\b([A-Z]{2,4}[0-9]{2,6}[A-Z0-9]*)\b", text.upper()
    )
    model = model_match.group(1) if model_match else None

    return {
        "author": author,
        "source_type": "field_experience",
        "source_url": None,
        "source_title": None,
        "brand": brand,
        "model": model,
        "model_family": None,
        "equipment_type": equipment_type,
        "alarm_codes": alarm_codes,
        "components": components,
        "symptoms": symptoms,
        "problem_summary": problem_summary,
        "field_technique": field_technique,
        "safety_notes": None,
        "limitations": None,
        "evidence_level": "field_experience",
        "confidence": "medium",
        "status": "draft",
        "metadata": {
            "extracted_at": datetime.utcnow().isoformat(),
            "paragraphs_count": len(paragraphs),
            "brands_detected": brands_found,
        },
    }


def interactive_ingest() -> str:
    """Prompt user for field case details and insert to Postgres."""
    print("\n=== HVAC Field Case Ingest (/ensinar) ===\n")

    author = input("Author: ").strip() or "unknown"
    brand = input("Brand (e.g. Daikin, Springer, Midea): ").strip() or None
    alarm_code_raw = input("Alarm codes (comma-separated, e.g. U4-01,L2): ").strip()
    alarm_codes = (
        [a.strip().upper() for a in alarm_code_raw.split(",") if a.strip()]
        if alarm_code_raw
        else []
    )
    component_raw = input("Components (comma-separated): ").strip()
    components = (
        [c.strip() for c in component_raw.split(",") if c.strip()]
        if component_raw
        else []
    )
    equipment_type = input("Equipment type (VRV/Split/Cassete/etc, default HVAC): ").strip() or "HVAC"
    problem_summary = input("\nProblem summary: ").strip()
    while not problem_summary:
        print("  Problem summary is required.")
        problem_summary = input("Problem summary: ").strip()

    field_technique = input("\nField technique (what was done): ").strip()
    safety_notes = input("\nSafety notes (optional): ").strip() or None

    case_card = {
        "author": author,
        "source_type": "field_experience",
        "source_url": None,
        "source_title": None,
        "brand": brand.title() if brand else None,
        "model": None,
        "model_family": None,
        "equipment_type": equipment_type.upper(),
        "alarm_codes": alarm_codes,
        "components": components,
        "symptoms": [],
        "problem_summary": problem_summary,
        "field_technique": field_technique,
        "safety_notes": safety_notes,
        "limitations": None,
        "evidence_level": "field_experience",
        "confidence": "medium",
        "status": "draft",
        "metadata": {"interactive": True, "extracted_at": datetime.utcnow().isoformat()},
    }

    case_id = insert_field_case(case_card)
    print(f"\n[DRAFT] Case created with ID: {case_id}")
    print("To approve and index, run:")
    print(f"  python hvac_field_case_ingest.py --approve-case {case_id}\n")
    return case_id


def approve_and_index(case_id: str) -> None:
    """Approve case in Postgres and index to Qdrant."""
    case = get_field_case(case_id)
    if not case:
        print(f"[ERROR] Case not found: {case_id}")
        sys.exit(1)

    if case.get("status") == "approved":
        print(f"[SKIP] Case {case_id} is already approved.")
        return

    if case.get("status") != "draft":
        print(f"[ERROR] Case {case_id} has status '{case.get('status')}', expected 'draft'.")
        sys.exit(1)

    approve_field_case(case_id)
    print(f"[APPROVED] Case {case_id} approved in Postgres.")

    try:
        index_field_case_approved(case_id)
        print(f"[INDEXED] Case {case_id} indexed to Qdrant.")
    except Exception as exc:
        print(f"[WARNING] Approved but Qdrant indexing failed: {exc}")
        print("To retry indexing later:")
        print(f"  python -c \"from hvac_field_memory import index_field_case_approved; index_field_case_approved('{case_id}')\"")


def list_pending_cases(author: Optional[str] = None) -> None:
    """List all draft cases, optionally filtered by author."""
    cases = list_field_cases(status="draft", author=author, limit=100)
    if not cases:
        print("No pending (draft) cases found.")
        return

    print(f"\n{'ID':<40} {'Author':<15} {'Brand':<10} {'Alarms':<15} {'Created':<20} Status")
    print("-" * 110)
    for case in cases:
        alarms = ",".join(case.get("alarm_codes") or []) or "-"
        created = str(case.get("created_at", ""))[:19]
        print(
            f"{str(case['id']):<40} "
            f"{case.get('author',''):<15} "
            f"{case.get('brand',''):<10} "
            f"{alarms:<15} "
            f"{created:<20} "
            f"{case.get('status','')}"
        )
    print()


def status_summary() -> None:
    """Show count of cases per status."""
    for status in ("draft", "approved", "deprecated"):
        cases = list_field_cases(status=status, limit=1000)
        print(f"  {status.capitalize():12s}: {len(cases)} cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HVAC Field Case Ingest Pipeline")
    parser.add_argument("--input", dest="input_text", help="Free-text field experience input")
    parser.add_argument("--author", default="willrefrimix", help="Author name (default: willrefrimix)")
    parser.add_argument("--approve-case", dest="approve_case", help="Approve and index a case by ID")
    parser.add_argument("--list-pending", action="store_true", help="List all pending draft cases")
    parser.add_argument("--author-filter", dest="author_filter", help="Filter by author when listing")
    parser.add_argument("--status", action="store_true", help="Show case count by status")
    parser.add_argument("--interactive", action="store_true", help="Interactive ingest mode")

    args = parser.parse_args()

    if args.interactive:
        interactive_ingest()
    elif args.input_text:
        card = extract_case_card_from_text(args.input_text, args.author)
        case_id = insert_field_case(card)
        print(f"[DRAFT] Case created: {case_id}")
        print("To approve and index:")
        print(f"  python hvac_field_case_ingest.py --approve-case {case_id}")
    elif args.approve_case:
        approve_and_index(args.approve_case)
    elif args.list_pending:
        list_pending_cases(author=args.author_filter)
    elif args.status:
        status_summary()
    else:
        parser.print_help()
