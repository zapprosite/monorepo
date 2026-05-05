#!/usr/bin/env python3
"""HVAC document fingerprinting — sha256 + shingles signature."""
import sys, json, hashlib, re
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

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\bpage \d+\b', '', text)
    text = re.sub(r'\b\d+\s*de\s*\d+\b', '', text)
    text = re.sub(r'--+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def shingles(text: str, k: int = 5) -> set:
    words = text.split()
    return set(' '.join(words[i:i+k]) for i in range(max(0, len(words)-k+1)))

def fingerprint(pdf_path: str, md_path: str) -> dict:
    raw_sha256 = hashlib.sha256(Path(pdf_path).read_bytes()).hexdigest()
    md_text = normalize_text(Path(md_path).read_text(errors='ignore'))
    norm_sha256 = hashlib.sha256(md_text.encode()).hexdigest()
    sh = sorted(shingles(md_text))[:1000]
    return {
        "doc_id": Path(pdf_path).stem,
        "raw_sha256": raw_sha256,
        "normalized_text_sha256": norm_sha256,
        "shingles_5gram": sh,
        "text_stats": {
            "chars": len(md_text),
            "words": len(md_text.split()),
            "lines": md_text.count('\n')
        },
        "md_path": str(md_path),
        "pdf_path": str(pdf_path)
    }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <pdf_path> <md_path>", file=sys.stderr)
        sys.exit(1)
    result = fingerprint(sys.argv[1], sys.argv[2])
    print(json.dumps(result, indent=2))