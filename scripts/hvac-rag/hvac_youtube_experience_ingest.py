"""
HVAC YouTube Experience Ingest Pipeline.
YouTube URL → metadata + summary → case card (draft).
"""

import os
import sys
import re
import argparse
from datetime import datetime
from typing import Optional

sys.path.insert(0, os.path.dirname(__file__))
from hvac_field_memory import (
    insert_field_case,
    approve_field_case,
    index_field_case_approved,
    get_field_case,
)

# ---------------------------------------------------------------------------
# YouTube URL parsing
# ---------------------------------------------------------------------------

YOUTUBE_URL_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})"),
]


def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    for pattern in YOUTUBE_URL_PATTERNS:
        m = pattern.search(url)
        if m:
            return m.group(1)
    return None


def extract_youtube_metadata(url: str) -> dict:
    """
    Fetch YouTube video metadata.
    Uses pytube or yt-dlp if available, otherwise returns minimal metadata
    with just the video_id extracted from the URL.
    """
    video_id = extract_video_id(url)
    if not video_id:
        return {"url": url, "video_id": None, "error": "Could not parse video ID from URL"}

    metadata = {
        "url": url,
        "video_id": video_id,
        "title": None,
        "channel": None,
        "duration": None,
        "description": None,
    }

    # Try pytube first
    try:
        import pytube
        yt = pytube.YouTube(url)
        metadata["title"] = yt.title
        metadata["channel"] = yt.channel or yt.author
        metadata["duration"] = yt.length
        try:
            metadata["description"] = yt.description or ""
        except Exception:
            metadata["description"] = ""
        return metadata
    except ImportError:
        pass
    except Exception as e:
        metadata["pytube_error"] = str(e)

    # Try yt-dlp
    try:
        import yt_dlp
        opts = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info:
                metadata["title"] = info.get("title")
                metadata["channel"] = info.get("channel") or info.get("uploader")
                metadata["duration"] = info.get("duration")
                metadata["description"] = info.get("description") or ""
        return metadata
    except ImportError:
        pass
    except Exception as e:
        metadata["yt_dlp_error"] = str(e)

    return metadata


# ---------------------------------------------------------------------------
# Keyword sets (same as text ingest)
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
    "multi-split", "duty", "chiller",
]


def _normalize(text: str) -> str:
    return text.lower() if text else ""


def _find_all(text: str, keywords: list[str]) -> list[str]:
    norm = _normalize(text)
    found = []
    for kw in keywords:
        if kw.lower() in norm:
            found.append(kw)
    return found


def _extract_alarm_codes(text: str) -> list[str]:
    if not text:
        return []
    return list(set(ALARM_CODE_PATTERN.findall(text.upper())))


def generate_technical_summary(metadata: dict, description: str = "") -> str:
    """
    Generate a brief technical summary from YouTube title + description.
    No LLM — keyword extraction only. Returns 2-3 sentences.
    """
    title = metadata.get("title") or ""
    desc = description or metadata.get("description") or ""
    full_text = f"{title} {desc}"

    brands = _find_all(full_text, BRAND_KEYWORDS)
    alarms = _extract_alarm_codes(full_text)
    components = _find_all(full_text, COMPONENT_KEYWORDS)
    equipment = _find_all(full_text, EQUIPMENT_KEYWORDS)

    parts = []
    if brands:
        parts.append(f"Brand(s): {', '.join(brands)}")
    if equipment:
        parts.append(f"Equipment type: {', '.join(equipment)}")
    if alarms:
        parts.append(f"Alarm code(s): {', '.join(alarms)}")
    if components:
        parts.append(f"Components: {', '.join(components)}")

    summary = "; ".join(parts) if parts else "General HVAC technical content."
    return summary


def create_youtube_case_card(
    metadata: dict,
    summary: str,
    author: str = "youtube",
) -> dict:
    """
    Build a draft case card from YouTube metadata + generated summary.
    """
    title = metadata.get("title") or ""
    channel = metadata.get("channel") or None
    video_id = metadata.get("video_id") or ""
    url = metadata.get("url") or ""

    full_text = f"{title} {metadata.get('description') or ''}"

    brands_found = _find_all(full_text, BRAND_KEYWORDS)
    brand = brands_found[0].title() if brands_found else None

    equip_found = _find_all(full_text, EQUIPMENT_KEYWORDS)
    equipment_type = equip_found[0].upper() if equip_found else "HVAC"

    alarm_codes = _extract_alarm_codes(full_text)
    components = _find_all(full_text, COMPONENT_KEYWORDS)

    # Build source_title: "Channel - Title" truncated to 255
    source_title = f"{channel} - {title}" if channel else title
    if len(source_title) > 255:
        source_title = source_title[:252] + "..."

    return {
        "author": author,
        "source_type": "youtube_summary",
        "source_url": url,
        "source_title": source_title,
        "brand": brand,
        "model": None,
        "model_family": None,
        "equipment_type": equipment_type,
        "alarm_codes": alarm_codes,
        "components": components,
        "symptoms": [],
        "problem_summary": summary,
        "field_technique": None,
        "safety_notes": None,
        "limitations": "YouTube content should be verified by field technician",
        "evidence_level": "video_summary",
        "confidence": "low",
        "status": "draft",
        "metadata": {
            "video_id": video_id,
            "channel": channel,
            "duration_seconds": metadata.get("duration"),
            "ingested_at": datetime.utcnow().isoformat(),
        },
    }


def approve_and_index(case_id: str) -> None:
    """Approve YouTube case and index to Qdrant."""
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
        print("To retry:")
        print(f"  python -c \"from hvac_field_memory import index_field_case_approved; index_field_case_approved('{case_id}')\"")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HVAC YouTube Experience Ingest")
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument("--author", default="youtube", help="Author (default: youtube)")
    parser.add_argument("--approve-case", dest="approve_case", help="Approve and index a case by ID")

    args = parser.parse_args()

    if args.approve_case:
        approve_and_index(args.approve_case)
    else:
        metadata = extract_youtube_metadata(args.url)

        if metadata.get("video_id") is None:
            print(f"[ERROR] Could not extract video ID from URL: {args.url}")
            sys.exit(1)

        title = metadata.get("title") or "(title unavailable)"
        channel = metadata.get("channel") or "(channel unavailable)"
        print(f"\nYouTube: {title}")
        print(f"Channel: {channel}")
        if metadata.get("duration"):
            mins = metadata["duration"] // 60
            secs = metadata["duration"] % 60
            print(f"Duration: {mins}m {secs}s")

        summary = generate_technical_summary(metadata)
        print(f"\nTechnical summary: {summary}\n")

        card = create_youtube_case_card(metadata, summary, author=args.author)
        case_id = insert_field_case(card)
        print(f"[DRAFT] YouTube case created: {case_id}")
        print("To approve and index:")
        print(f"  python hvac_youtube_experience_ingest.py --approve-case {case_id}\n")
