#!/usr/bin/env python3
"""Universal HVAC input extractor — parses queries into structured fields.

Extracts brand, model, error codes, equipment type, and symptom from arbitrary
HVAC-related input text. Used as the intake layer for the HVAC RAG pipeline.

Functions:
    extract_brand(query) -> tuple[brand: str | None, confidence: float]
    extract_model(query) -> str | None
    extract_error_codes(query) -> list[str]
    extract_equipment_type(query) -> str | None
    extract_symptom(query) -> str
    parse_universal(query) -> dict
"""

from __future__ import annotations

import re
from typing import Optional

# --------------------------------------------------------------------------- #
# Brand list & fuzzy matching
# --------------------------------------------------------------------------- #

# All brands that may appear in Brazilian HVAC context.
# Stored in lowercase for case-insensitive matching.
_BRAND_CANONICAL = {
    "daikin": "Daikin",
    "springer": "Springer",
    "midea": "Midea",
    "carrier": "Carrier",
    "komeco": "Komeco",
    "elgin": "Elgin",
    "gree": "Gree",
    "agratto": "Agratto",
    "comfee": "Comfee",
    "lg": "LG",
    "samsung": "Samsung",
    "fujitsu": "Fujitsu",
    "trane": "Trane",
    "hitachi": "Hitachi",
    "vrf": "VRF",
    "vrv": "VRV",
    "acj": "ACJ",
    # Extended inverter/import brands commonly found in Brazil
    "keko": "Keko",
    "midian": "Midiam",
    "comfeeair": "Comfee",
    "greeclimate": "Gree",
    "daikinbrasil": "Daikin",
    "elginac": "Elgin",
    "carrierac": "Carrier",
    "hitachiac": "Hitachi",
    "fujitsuac": "Fujitsu",
    "samsungac": "Samsung",
    "lgac": "LG",
    "traneac": "Trane",
    # Typos / variations
    "daiking": "Daikin",
    "daykin": "Daikin",
    "sprintel": "Springer",
    "springuer": "Springer",
    "greee": "Gree",
    "greeeclimate": "Gree",
    "mideia": "Midea",
    "midia": "Midea",
    "komecoac": "Komeco",
    "carrrier": "Carrier",
    "carrierre": "Carrier",
    "trag": "Trane",
    "tranhe": "Trane",
    "fujitsuu": "Fujitsu",
    "fujiitsu": "Fujitsu",
    "hitachii": "Hitachi",
    "hittachi": "Hitachi",
    "samssung": "Samsung",
    "samsumg": "Samsung",
    "lgelectronics": "LG",
    "agrato": "Agratto",
    "agration": "Agratto",
    "elginn": "Elgin",
    "comfeeair": "Comfee",
    "kekoac": "Keko",
}

# Score threshold for accepting a fuzzy match (0–100).
_FUZZY_THRESHOLD = 72


def _fuzzy_score(a: str, b: str) -> float:
    """Return a 0–100 similarity score between two strings.

    Uses a simple sliding-window edit-distance ratio so this module has
    no third-party dependencies beyond the standard library.
    """
    if not a or not b:
        return 0.0
    a_lower = a.lower()
    b_lower = b.lower()
    shorter, longer = (a_lower, b_lower) if len(a_lower) <= len(b_lower) else (b_lower, a_lower)

    # Substring match only when shorter appears at a word boundary in longer.
    # This prevents e.g. "acj" from scoring high inside "completely".
    if shorter in longer:
        start = longer.find(shorter)
        end = start + len(shorter)
        before_ok = (start == 0) or (not longer[start - 1].isalnum())
        after_ok = (end == len(longer)) or (not longer[end].isalnum())
        if before_ok and after_ok:
            return 90.0 + 10.0 * (len(shorter) / max(len(longer), 1))
        # Fall through to edit distance for non-boundary substrings

    # Levenshtein-like ratio via iterative expansion
    max_dist = max(0, len(longer) - len(shorter))
    threshold = max(0, (100 - _FUZZY_THRESHOLD) / 100 * len(longer))
    if max_dist > threshold:
        return 0.0
    # Damerau-Levenshtein distance with transposition (simplified)
    d = _damerau_levenshtein(shorter, longer)
    ratio = max(0.0, 1.0 - d / max(len(longer), 1))
    return ratio * 100


def _damerau_levenshtein(s1: str, s2: str) -> int:
    """Compute Damerau-Levenshtein distance between two strings."""
    if not s1:
        return len(s2)
    if not s2:
        return len(s1)
    d = {}
    s1_len, s2_len = len(s1), len(s2)
    for i in range(-1, s1_len + 1):
        d[(i, -1)] = i + 1
    for j in range(-1, s2_len + 1):
        d[(-1, j)] = j + 1
    for i in range(s1_len):
        for j in range(s2_len):
            cost = 0 if s1[i] == s2[j] else 1
            d[(i, j)] = min(
                d[(i - 1, j)] + 1,       # deletion
                d[(i, j - 1)] + 1,       # insertion
                d[(i - 1, j - 1)] + cost  # substitution
            )
            if (i > 0 and j > 0 and s1[i] == s2[j - 1] and s1[i - 1] == s2[j]):
                d[(i, j)] = min(d[(i, j)], d[(i - 2, j - 2)] + cost)  # transposition
    return d[(s1_len - 1, s2_len - 1)]


def _tokenize(text: str) -> list[str]:
    """Split text on non-alphanumeric boundaries."""
    return re.split(r'[\s\-_/\\,;]+', text.lower())


def _best_brand_match(token: str) -> tuple[str | None, float]:
    """Return (canonical_brand, confidence) for a single token."""
    # Direct canonical lookup (case-insensitive)
    if token in _BRAND_CANONICAL:
        return _BRAND_CANONICAL[token], 100.0
    # Fuzzy match against all known brand keys
    best_score = 0.0
    best_brand = None
    for brand_key, canonical in _BRAND_CANONICAL.items():
        score = _fuzzy_score(token, brand_key)
        if score > best_score:
            best_score = score
            best_brand = canonical
    if best_score >= _FUZZY_THRESHOLD:
        return best_brand, best_score
    return None, 0.0


# --------------------------------------------------------------------------- #
# Error-code patterns
# --------------------------------------------------------------------------- #

# Single-letter prefix followed by 1–4 digits (E1–E9999, A1–A9999, …)
# Requires at least one digit after the letter prefix (E0 / A0 alone are invalid).
_ERROR_CODE_RE = re.compile(
    r'\b([EAFULPCd][0-9]{1,4})\b',
    re.IGNORECASE
)

# Composite codes: E04-01, L4-02, etc. (also requires digits after letter).
_ERROR_COMPOSITE_RE = re.compile(
    r'\b([EAFULPCd][0-9]{1,4}[-–][0-9]{1,4})\b',
    re.IGNORECASE
)


# --------------------------------------------------------------------------- #
# Model-number patterns
# --------------------------------------------------------------------------- #

# Daikin VRV / VRF series
_VRV_PATTERNS = [
    re.compile(r'\b(RXYQ\d+[A-Z]?(?:\d+[A-Z]?)*)\b', re.IGNORECASE),
    re.compile(r'\b(RYYQ\d+[A-Z]?(?:\d+[A-Z]?)*)\b', re.IGNORECASE),
    re.compile(r'\b(FXMQ\d+[A-Z]?)\b', re.IGNORECASE),
    re.compile(r'\b(FXAQ\d+[A-Z]?)\b', re.IGNORECASE),
    re.compile(r'\b(REYQ\d+[A-Z]?)\b', re.IGNORECASE),
    re.compile(r'\b(RQEQ\d+[A-Z]?)\b', re.IGNORECASE),
    re.compile(r'\b(RQFYQ\d+[A-Z]?)\b', re.IGNORECASE),
    # VRV / VRF are equipment types, not model numbers — skip them here
    # so they don't get returned as spurious "model" values.
    # Actual VRV model numbers (RXYQ, RYYQ, etc.) are captured above.
]

# Generic split / multi-split model patterns (alphanumeric, 4+ chars).
# Uses a permissive pattern that matches common HVAC model formats
# (e.g., RXYQ48PAYS1A, AR09TXHQASINUA, GHP12AJ3NA, AS09NKH).
_GENERIC_MODEL_RE = re.compile(
    r'\b([A-Z]{2,6}[0-9]{2,6}(?:[A-Z0-9]{1,6})*)\b',
    re.IGNORECASE
)

# Single outdoor unit code like Komeco, Springer, Elgin, Gree domestic lines
_OUTDOOR_UNIT_RE = re.compile(
    r'\b(KOM[\-]?\d+[A-Z]?|SPR[\-]?\d+[A-Z]?|ELG[\-]?\d+[A-Z]?|'
    r'GR[\-]?\d+[A-Z]?|MC[\-]?\d+[A-Z]?|AGR[\-]?\d+[A-Z]?)\b',
    re.IGNORECASE
)


# --------------------------------------------------------------------------- #
# Equipment-type signals
# --------------------------------------------------------------------------- #

_EQUIPMENT_SIGNALS: dict[str, list[str]] = {
    "VRF": [
        "vrf", "vrv", "vrff", "variable refrigerant flow",
        "variable refrigerant volume", "vrv system", "vrf system",
    ],
    "VRV": [
        "vrv", "vrv iv", "vrv iii", "vrv ii", "vrv i",
        "daikin vrv", "daikin vrf", "vrv heat pump", "vrv inverter",
    ],
    "split": [
        "split", "split system", "inverter split",
        "split mural", "split parede",
        "wall mounted", "wall-mounted", "high wall",
        "split de parede", "split parede", "split compressor",
        "condensadora", "evaporadora", "unidade externa",
        "unidade interna", "outdoor unit", "indoor unit",
        "evap", "conden", "outdoor", "indoor",
        "inverter", "inverter split",
    ],
    "multi-split": [
        "multi split", "multi-split", "multi split system",
        "multi inverter", "multisplit", "multi-split",
    ],
    "cassete": [
        "cassete", "cassette", "cassette ceiling",
        "teto cassete", "cassete de teto", "cassete de forro",
        "4-way cassette", "cassete 4 vias", "cassete 2 vias",
        "cassete 360",
    ],
    "piso-teto": [
        "piso teto", "piso-teto", "floor ceiling",
        "consola", "console", "gabinete", "cabinet",
        "vertical", "ductable", "ductable unit",
        "piso e teto", "piso/teto",
    ],
    "hi-wall": [
        "hi-wall", "hi wall", "high wall",
        "split mural", "mural", "parede", "de parede",
    ],
    "chiller": [
        "chiller", "chiler", "chiller de agua", "chiller de água",
        "water chiller", "chiller ar", "chiller centrifugo",
        "chiller de absorcao", "chiller de absorção",
    ],
}


# --------------------------------------------------------------------------- #
# Symptom extraction heuristics
# --------------------------------------------------------------------------- #

_SYMPTOM_PATTERNS = [
    re.compile(r'\b(?:error(?:\s*code)?|cod(?:igo)?\s*de\s*erro|falha|código\s*erro)\s*[:;]?\s*([A-Z0-9\-]+)', re.IGNORECASE),
    re.compile(r'\b(?:erro|failure|fault)\s*(?:code)?\s*[:;]?\s*([A-Z0-9\-]{2,10})\b', re.IGNORECASE),
    re.compile(r'\b(?:não\s*(?:liga|funciona|liga|responde|congela|gela|esfria|aquece)|'
               r'does\s*not\s*(?:start|run|cool|heat|respond|freeze)|'
               r'not\s*(?:turning\s*on|running|cooling|heating))\b', re.IGNORECASE),
    re.compile(r'\b(?:compressor\s*(?:não\s*)?(?:liga|funciona|paralisa)|'
               r'compressor\s*(?:won\'?t\s*)?(?:start|run|engage))\b', re.IGNORECASE),
    re.compile(r'\b(?:desliga|sdesliga|desligando|parando|para\s*(?:de\s*)?funcionar|'
               r'shuts?\s*(?:down|off)|stops?\s*(?:running|working))\b', re.IGNORECASE),
    re.compile(r'\b(?:falha|fault|alarme|alarm|bloqueio|bloqueado|locked\s*out)\b', re.IGNORECASE),
    re.compile(r'\b(?:vibração|vibracao|vibrates?|ruído|ruido|noise)\b', re.IGNORECASE),
    re.compile(r'\b(?:não\s*congela|gelo|formação\s*de\s*gelo|ice\s*formation|freezing)\b', re.IGNORECASE),
    re.compile(r'\b(?:não\s*esfria|poor\s*cooling|insufficient\s*cooling|cool\s*doesn\'?t\s*work)\b', re.IGNORECASE),
    re.compile(r'\b(?:não\s*aquece|poor\s*heating|insufficient\s*heating|heat\s*doesn\'?t\s*work)\b', re.IGNORECASE),
    re.compile(r'\b(?:sensor|thermistor|probe)\s*(?:defeito|falha|broken|faulty)\b', re.IGNORECASE),
    re.compile(r'\b(?:led\s*)?(?:pisca|blink|blinking|flash|flashing)\b', re.IGNORECASE),
    re.compile(r'\b(?:pressão|pressure|alta|low|high|baixa|elevada)\s*(?:do\s*)?(?:refrigerante|refrigerant)\b', re.IGNORECASE),
    re.compile(r'\b(?:refrigerante|refrigerant)\s*(?:baixo|low|alto|high|vazamento|leak)\b', re.IGNORECASE),
    re.compile(r'\b(?:vazamento|leak|estanquezidade|leaking)\b', re.IGNORECASE),
]


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def extract_brand(query: str) -> tuple[Optional[str], float]:
    """Extract the most likely brand from a query string.

    Uses tokenization + fuzzy matching against all known brand variants.
    Returns ``(brand, confidence)`` where confidence is 0–100.
    Returns ``(None, 0.0)`` if no plausible brand is found.
    """
    if not query:
        return None, 0.0

    tokens = _tokenize(query)
    brand_scores: dict[str, float] = {}

    for token in tokens:
        if not token:
            continue
        brand, score = _best_brand_match(token)
        if brand and score > 0:
            # Keep highest score per canonical brand
            brand_scores[brand] = max(brand_scores.get(brand, 0), score)

    if not brand_scores:
        return None, 0.0

    best_brand = max(brand_scores, key=lambda b: brand_scores[b])
    return best_brand, round(brand_scores[best_brand], 2)


def extract_model(query: str) -> Optional[str]:
    """Extract the first plausible model / model family from a query.

    Checks VRV/VRF patterns first (more specific), then generic model
    patterns.  Returns ``None`` if nothing identifiable is found.
    """
    if not query:
        return None

    # VRV / Daikin series first
    for pat in _VRV_PATTERNS:
        m = pat.search(query)
        if m:
            return m.group(1).upper()

    # Outdoor unit codes
    m = _OUTDOOR_UNIT_RE.search(query)
    if m:
        return m.group(1).upper()

    # Generic model (alphanumeric, 4+ chars)
    for m in _GENERIC_MODEL_RE.finditer(query):
        candidate = m.group(1).upper()
        # Reject pure numeric or too short
        if len(candidate) >= 4 and not candidate.isdigit():
            # Reject if it looks like a temperature or pressure value
            if re.fullmatch(r'[A-Z]{1,2}[0-9]{1,4}', candidate):
                return candidate
            # Reject common words that slip through
            if candidate in ("IN", "ON", "OF", "TO", "OR", "AND"):
                continue
            return candidate

    return None


def extract_error_codes(query: str) -> list[str]:
    """Extract all error codes from a query.

    Handles:
    - Simple codes: E05, A03, F12, U1, L4, P9, C2, d0
    - Composite codes: E04-01, L4-02 (treated as E0401, L402 internally)

    Returns a sorted de-duplicated list.
    """
    if not query:
        return []

    codes: set[str] = set()

    # Composite first (longer match should take precedence)
    for m in _ERROR_COMPOSITE_RE.finditer(query):
        raw = m.group(1).upper()
        # Normalize: E04-01 -> E0401
        normalized = raw.replace('-', '').replace('–', '')
        codes.add(normalized)

    # Simple codes
    for m in _ERROR_CODE_RE.finditer(query):
        raw = m.group(1).upper()
        # Skip if this is a substring of an already-captured composite
        skip = False
        for existing in list(codes):
            if existing.startswith(raw) or raw in existing:
                skip = True
                break
        if not skip:
            codes.add(raw)

    return sorted(codes)


def extract_equipment_type(query: str) -> Optional[str]:
    """Detect equipment type from query context.

    Returns one of: ``split``, ``multi-split``, ``cassete``, ``piso-teto``,
    ``hi-wall``, ``VRF``, ``VRV``, ``chiller``, or ``None``.
    """
    if not query:
        return None

    text_lower = query.lower()
    scores: dict[str, float] = {}

    for eq_type, signals in _EQUIPMENT_SIGNALS.items():
        for signal in signals:
            # Substring count weighted by signal length (longer = more specific)
            count = text_lower.count(signal.lower())
            if count > 0:
                weight = len(signal)  # longer match = more specific
                scores[eq_type] = scores.get(eq_type, 0) + count * weight

    if not scores:
        return None

    # Return highest-scoring type
    return max(scores, key=lambda t: scores[t])


def extract_symptom(query: str) -> str:
    """Extract a human-readable symptom description from a query.

    Strips error codes and brand/model noise, returning the remaining
    narrative (what is happening / what is wrong).
    """
    if not query:
        return ""

    # Remove error codes
    text = _ERROR_COMPOSITE_RE.sub('', query)
    text = _ERROR_CODE_RE.sub('', text)

    # Remove model numbers
    text = re.sub(r'\b(RXYQ|RYYQ|FXMQ|FXAQ|REYQ|RQEQ|RQFYQ|'
                  r'VRV|VRF|KOM[\-]?\d+|SPR[\-]?\d+|ELG[\-]?\d+|'
                  r'GR[\-]?\d+|MC[\-]?\d+|AGR[\-]?\d+)\b',
                  '', text, flags=re.IGNORECASE)

    # Remove isolated digits
    text = re.sub(r'\b\d+\b', '', text)

    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # If nothing meaningful remains, return a generic placeholder
    if not text or len(text) < 3:
        return "symptom not clearly described"

    # Capitalise first letter only
    return text[0].upper() + text[1:] if text else ""


def normalize_query(query: str) -> str:
    """Return a lowercased, punctuation-stripped, collapsed whitespace query."""
    if not query:
        return ""
    # Remove punctuation except hyphens in compound terms
    text = re.sub(r'[^\w\s\-]', ' ', query)
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text


def parse_universal(query: str) -> dict:
    """Parse an arbitrary HVAC query into a fully structured dictionary.

    Returns:
        dict with keys:
            - raw_query: original input
            - normalized_query: cleaned lowercased query
            - brand: detected brand or None
            - brand_confidence: 0–100 confidence score for brand
            - model: detected model string or None
            - error_codes: list of all detected codes
            - equipment_type: detected type or None
            - symptom: human-readable symptom description
            - is_hvac: bool, True if query appears HVAC-related
    """
    raw_query = query
    normalized_query = normalize_query(query)

    brand, brand_confidence = extract_brand(query)
    model = extract_model(query)
    error_codes = extract_error_codes(query)
    equipment_type = extract_equipment_type(query)
    symptom = extract_symptom(query)

    # Simple HVAC relevance gate: contains at least one brand, error code,
    # equipment type, or known HVAC keyword
    _HVAC_KEYWORDS = re.compile(
        r'\b(inverter|vrv|vrf|hvac|compressor|evaporador|condensador|'
        r'refrigerante|split|cassete|chiller|termistor|sensor\s*temp|'
        r'pressao|pressao\s*alta|pressao\s*baixa|falha\s*compressor|'
        r'erro\s*interno|bloqueio\s*compressor|pisca\s*led|led\s*alarme)\b',
        re.IGNORECASE
    )
    is_hvac = bool(
        brand or
        error_codes or
        equipment_type or
        _HVAC_KEYWORDS.search(query)
    )

    return {
        "raw_query": raw_query,
        "normalized_query": normalized_query,
        "brand": brand,
        "brand_confidence": brand_confidence,
        "model": model,
        "error_codes": error_codes,
        "equipment_type": equipment_type,
        "symptom": symptom,
        "is_hvac": is_hvac,
    }


# --------------------------------------------------------------------------- #
# CLI (basic self-test)
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    import json, sys

    test_queries = [
        "Erro E04-01 no Springer Inverter 12.000 BTU split",
        "Daikin VRV IV RXYQ10PA fault code L4-02 compressor not starting",
        "Komeco multi split 18.000 BTU não esfria erro E07",
        "Fault F3 on Gree GHP12AJ3NA i2H fault compressor shutdown",
        "Midea cassette 36.000 BTU error U4-01",
        "Elgin piso teto 24.000 error A12",
        "Hi-wall LG 12.000 não liga LED piscando E05",
        "Samsung AR09TXHQASINUA error codes E0, E4, F3",
        "Trane chiller water cooled error P10",
        "Hitachi VRF system RXYQ48PAYS1A fault",
        "Não funciona split Agratto 7500 BTU erro 0-03",
        "Fujitsu inverter 9000 compressore non avvia E2",
        "Invalid query from a completely different domain",
        "compressore bloccatoserreno",  # Should still pick up compressor
    ]

    print(f"{'='*60}")
    print(f"hvac_intake.py — self-test ({len(test_queries)} queries)")
    print(f"{'='*60}\n")

    for q in test_queries:
        result = parse_universal(q)
        print(f"QUERY : {q}")
        print(f"RESULT: {json.dumps({k: v for k, v in result.items() if k not in ('raw_query', 'normalized_query')}, ensure_ascii=False)}")
        print()
