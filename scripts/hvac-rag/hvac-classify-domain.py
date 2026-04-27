#!/usr/bin/env python3
"""HVAC domain classifier — heuristic scoring."""
import sys, json, re
from pathlib import Path

POSITIVE_PATTERNS = [
    (r'\b(inverter|vrv|vrf|hvac)\b', 0.15),
    (r'\b(air\s*conditioner|heat\s*pump|refrigerant|compressor)\b', 0.10),
    (r'\b(evaporator|condenser|indoor\s*unit|outdoor\s*unit)\b', 0.08),
    (r'\b(error\s*code|service\s*manual|installation\s*manual|troubleshooting)\b', 0.12),
    (r'\b(r32|r410a|r22|r134a)\b', 0.10),
    (r'\b(eev|thermistor|pcb|fan\s*motor|pressure\s*sensor)\b', 0.08),
    (r'\b(rxyq|ryyq|ar\d|msz\d|as\d{2})\b', 0.10),
    (r'\b(split|wall\s*mounted|cassette|floor\s*ceiling)\b', 0.07),
]
NEGATIVE_PATTERNS = [
    (r'\b(contrato|nota\s*fiscal|política|currículo|marketing)\b', -0.20),
    (r'\b(tv|geladeira|lavadora|monitor)\b', -0.30),
]

def classify(md_path: str) -> dict:
    text = Path(md_path).read_text(errors='ignore').lower()
    score = 0.0
    hits = []
    for pattern, weight in POSITIVE_PATTERNS + NEGATIVE_PATTERNS:
        found = re.findall(pattern, text, re.IGNORECASE)
        if found:
            score += weight * len(found)
            hits.append((pattern, weight, len(found)))
    if score >= 0.75:
        status = "accepted_hvac_technical"
    elif score >= 0.45:
        status = "needs_review"
    else:
        status = "rejected_non_hvac"
    return {
        "doc_id": Path(md_path).stem,
        "md_path": str(md_path),
        "domain_score": round(score, 4),
        "domain_status": status,
        "hit_count": len(hits),
        "top_hits": [(p.pattern, w, c) for p, w, c in hits[:10]]
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <md_path>", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(classify(sys.argv[1]), indent=2))