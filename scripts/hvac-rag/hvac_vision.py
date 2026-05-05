#!/usr/bin/env python3
"""
HVAC Vision Tool — T-OW05
Extracts HVAC-relevant information from images using qwen2.5vl:3b via Ollama.

Used ONLY as an internal tutor tool (NOT exposed as a public model).
Flow: image attachment → type detection → Ollama API call → extract text/code →
inject into conversation state.

Model: qwen2.5vl:3b via Ollama at localhost:11434
"""

import base64
import json
import os
import re
import sys
from enum import Enum
from pathlib import Path
from typing import Optional

import httpx


# =============================================================================
# Configuration
# =============================================================================
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
VISION_MODEL = os.environ.get("HVAC_VISION_MODEL", "qwen2.5vl:3b")
OLLAMA_TIMEOUT = 60


# =============================================================================
# Image Type Classification
# =============================================================================

class ImageType(str, Enum):
    DISPLAY = "display"          # Seven-segment / digital display showing error codes
    NAMEPLATE = "nameplate"      # Equipment nameplate with model, serial, electrical specs
    LABEL = "label"              # Warning/label sticker on unit
    WIRING_DIAGRAM = "wiring"    # Wiring diagram or schematic
    ERROR_LOG = "error_log"     # Error history / fault log screen
    PCB = "pcb"                  # PCB / inverter board photo
    UNKNOWN = "unknown"


DISPLAY_PATTERNS = [
    r"\d{2,4}-\d{2,4}",  # error codes like U4-01, E3-02
    r"[A-Z]\d{1,4}",      # single-letter codes like A1, F4
    r"seven.?segment",
    r"display",
    r"c[o0]dig[o0]",
    r"erro",
    r"fault",
    r"alarm",
]

NAMEPLATE_PATTERNS = [
    r"model[o0]?",      # model number
    r"serial",
    r"model[o0]",
    r"220v", r"380v", r"400v",
    r"~[0-9]+[vhz]",
    r"[0-9]+\s*[wv]a",  # VA rating
    r"[0-9]+[\s]*amp",
    r"refrigerant",
    r"r[2341]0",
    r"btu",
]

LABEL_PATTERNS = [
    r"warning",
    r"caution",
    r"danger",
    r"high voltage",
    r"alta tens",
    r"aten[çc][aã]o",
    r"perigo",
    r"seguran[çc]a",
    r"lockout",
    r"tagout",
]


def classify_image_type(image_base64: str, context_hints: list[str] | None = None) -> ImageType:
    """
    Classify image type based on a small base64 preview hint.
    Falls back to ImageType.UNKNOWN if classification is inconclusive.
    """
    # Decode a small prefix to inspect content hints
    hints = context_hints or []

    combined = " ".join(hints).lower()

    # Quick heuristics before sending to model
    if any(p in combined for p in ["display", "seven segment", "7 segmento", "7-seg", "código", "erro", "fault", "alarm", "u4", "e3", "a1"]):
        return ImageType.DISPLAY
    if any(p in combined for p in ["nameplate", "placa", "etiqueta", "modelo", "serial", "220v", "380v", "btu", "refrigerant"]):
        return ImageType.NAMEPLATE
    if any(p in combined for p in ["warning", "caution", "danger", "alta tens", "perigo", "seguran"]):
        return ImageType.LABEL

    return ImageType.UNKNOWN


def build_vision_prompt(image_type: ImageType, context_hints: list[str] | None = None) -> str:
    """Build the extraction prompt based on detected image type."""
    base = (
        "Você é um assistente HVAC especializado em extrair informações técnicas de imagens. "
        "Analise a imagem e retorne APENAS um JSON válido com os campos identificados."
    )

    context_str = ""
    if context_hints:
        context_str = f"\n\nContexto da conversa: {' '.join(context_hints)}"

    if image_type == ImageType.DISPLAY:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra um display de ar condicionado ( sete segmentos, digital ou LED )."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"display\","
            "\n  \"error_codes\": [\"U4-01\", \"E3\"],"
            "\n  \"unit_status\": \"descrição breve do status mostrado (ex: 'Standby', 'Rodando', 'Erro')\","
            "\n  \"temperature_setting\": \"temperatura mostrada (se visível)\","
            "\n  \"operating_mode\": \"modo de operação (ex: 'Resfriamento', 'Aquecimento', 'Ventilação')\","
            "\n  \"additional_info\": \"outras informações visíveis no display\""
            "\n}"
            "\n\nSe não houver códigos de erro visíveis, retorne error_codes como array vazio []."
            "\nSe não souber algum valor, use null."
        )

    elif image_type == ImageType.NAMEPLATE:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra uma placa de identificação de equipamento HVAC."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"nameplate\","
            "\n  \"outdoor_model\": \"modelo da unidade externa (ex: RXYQ20BRY)\","
            "\n  \"indoor_model\": \"modelo da unidade interna (se visível)\","
            "\n  \"serial_number\": \"número de série\","
            "\n  \"voltage\": \"tensão (ex: 220V, 380V)\","
            "\n  \"phase\": \"número de fases (ex: 3~ 50Hz)\","
            "\n  \"refrigerant\": \"refrigerante (ex: R-410A, R-32)\","
            "\n  \"btu_capacity\": \"capacidade em BTU/h (se visível)\","
            "\n  \"year\": \"ano de fabricação (se visível)\","
            "\n  \"brand\": \"marca (se identificável)\""
            "\n}"
        )

    elif image_type == ImageType.LABEL:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra uma etiqueta ou adesivo de advertência em equipment HVAC."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"label\","
            "\n  \"label_type\": \"tipo de etiqueta (warning, caution, general, etc.)\","
            "\n  \"warning_text\": \"texto completo de advertência ou informação\","
            "\n  \"safety_instructions\": [\"instrução 1\", \"instrução 2\"],"
            "\n  \"compliance_symbols\": [\"símbolos de conformidade identificados\"]"
            "\n}"
        )

    elif image_type == ImageType.WIRING_DIAGRAM:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra um diagrama de fiação ou esquema elétrico de HVAC."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"wiring_diagram\","
            "\n  \"diagram_type\": \"tipo de diagrama (wiring, schematic, circuit)\","
            "\n  \"components\": [\"componente 1\", \"componente 2\"],"
            "\n  \"wire_colors\": [\"cores de fio identificadas\"],"
            "\n  \"connection_points\": [\"pontos de conexão\"]"
            "\n}"
        )

    elif image_type == ImageType.ERROR_LOG:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra um histórico de erros ou log de falhas de um ar condicionado."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"error_log\","
            "\n  \"error_entries\": ["
            "\n    {\"code\": \"U4-01\", \"description\": \"descrição\", \"occurrences\": 3},"
            "\n  ],"
            "\n  \"most_frequent_error\": \"código mais frequente\","
            "\n  \"total_errors\": número total de erros no log"
            "\n}"
        )

    elif image_type == ImageType.PCB:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem mostra uma placa de circuito (PCB) ou placa inverter de ar condicionado."
            "\n\nRetorne um JSON com esta estrutura:"
            "\n{"
            "\n  \"image_type\": \"pcb\","
            "\n  \"board_type\": \"tipo de placa (inverter, main, control, etc.)\","
            "\n  \"component_labels\": [\"rótulos de componentes visíveis\"],"
            "\n  \"connector_pins\": [\"pinos de conector identificados\"],"
            "\n  \"led_status\": \"status de LEDs visíveis (verde, vermelho, laranja, apagado)\","
            "\n  \"visible_defects\": \"defeitos visíveis (capacitores estufados, solda fria, etc.)\""
            "\n}"
        )

    else:
        return (
            f"{base}"
            f"{context_str}"
            "\n\nEsta imagem é de um sistema HVAC. Analise o conteúdo e retorne:"
            "\n{"
            "\n  \"image_type\": \"unknown\","
            "\n  \"summary\": \"resumo do que é visível na imagem\","
            "\n  \"hvac_elements_found\": [\"elementos HVAC identificados\"],"
            "\n  \"technical_info\": \"informações técnicas relevantes extraídas\""
            "\n}"
        )


# =============================================================================
# Ollama Vision API
# =============================================================================

def ollama_headers() -> dict:
    return {"Content-Type": "application/json"}


async def extract_from_image(
    image_base64: str,
    context_hints: list[str] | None = None,
    image_type_hint: ImageType | None = None,
) -> dict:
    """
    Send image to qwen2.5vl:3b via Ollama and extract HVAC information.

    Args:
        image_base64: base64-encoded image data (with or without data URI prefix)
        context_hints: optional list of strings from conversation to help guide extraction
        image_type_hint: optional pre-classified image type to skip detection

    Returns:
        {
            "image_type": str,
            "raw_response": str,
            "parsed": dict | None,
            "error": str | None,
            "model": str,
            "usage": dict,
        }
    """
    # Strip data URI prefix if present
    b64 = image_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    # Classify image type
    img_type = image_type_hint or classify_image_type(b64, context_hints)

    # Build prompt
    prompt = build_vision_prompt(img_type, context_hints)

    payload = {
        "model": VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [b64],
            }
        ],
        "stream": False,
        "options": {
            "temperature": 0.1,  # low temperature for structured extraction
        },
    }

    result = {
        "image_type": img_type.value,
        "raw_response": "",
        "parsed": None,
        "error": None,
        "model": VISION_MODEL,
        "usage": {},
    }

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                headers=ollama_headers(),
                json=payload,
            )

            if resp.status_code != 200:
                result["error"] = f"Ollama returned {resp.status_code}: {resp.text[:200]}"
                return result

            data = resp.json()
            raw = data.get("message", {}).get("content", "")
            result["raw_response"] = raw

            # Parse JSON from response
            result["parsed"] = _parse_json_from_response(raw)

            # Usage stats if available
            result["usage"] = {
                "prompt_eval_count": data.get("prompt_eval_count", 0),
                "eval_count": data.get("eval_count", 0),
            }

    except httpx.TimeoutException:
        result["error"] = f"Timeout after {OLLAMA_TIMEOUT}s"
    except Exception as exc:
        result["error"] = str(exc)

    return result


def _parse_json_from_response(raw: str) -> dict | None:
    """Extract JSON object from model response text."""
    # Try direct JSON parse
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Try to find JSON in markdown code blocks
    json_pattern = r"```(?:json)?\s*(\{.*?\})\s*```"
    matches = re.findall(json_pattern, raw, re.DOTALL)
    for match in matches:
        try:
            return json.loads(match)
        except Exception:
            continue

    # Try to find raw JSON object
    brace_start = raw.find("{")
    if brace_start != -1:
        # Find the last closing brace
        depth = 0
        end = -1
        for i, ch in enumerate(raw[brace_start:], brace_start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end > brace_start:
            try:
                return json.loads(raw[brace_start:end])
            except Exception:
                pass

    return None


# =============================================================================
# Injectable State Update
# =============================================================================

def state_update_from_vision(result: dict) -> dict:
    """
    Convert vision extraction result into conversation state updates.

    Returns a dict that can be merged into the tutor's conversation state.
    Only fills fields that were successfully extracted.
    """
    parsed = result.get("parsed")
    if not parsed or result.get("error"):
        return {"vision_error": result.get("error", "no parse")}

    img_type = result.get("image_type", "unknown")
    update = {"vision_image_type": img_type}

    if img_type == "display":
        codes = parsed.get("error_codes", [])
        if codes:
            update["all_codes"] = codes
        status = parsed.get("unit_status", "")
        if status:
            update["display_status"] = status
        mode = parsed.get("operating_mode", "")
        if mode:
            update["operating_mode"] = mode
        temp = parsed.get("temperature_setting")
        if temp:
            update["temperature_setting"] = temp

    elif img_type == "nameplate":
        outdoor = parsed.get("outdoor_model", "")
        if outdoor:
            update["outdoor_model"] = outdoor
        indoor = parsed.get("indoor_model", "")
        if indoor:
            update["indoor_model"] = indoor
        serial = parsed.get("serial_number", "")
        if serial:
            update["serial_number"] = serial
        voltage = parsed.get("voltage", "")
        if voltage:
            update["voltage"] = voltage
        refrigerant = parsed.get("refrigerant", "")
        if refrigerant:
            update["refrigerant"] = refrigerant
        brand = parsed.get("brand", "")
        if brand:
            update["brand"] = brand
        btu = parsed.get("btu_capacity", "")
        if btu:
            update["btu_capacity"] = btu

    elif img_type == "error_log":
        entries = parsed.get("error_entries", [])
        if entries:
            update["error_log_entries"] = entries
        freq = parsed.get("most_frequent_error", "")
        if freq:
            update["most_frequent_error"] = freq

    elif img_type == "label":
        warning = parsed.get("warning_text", "")
        if warning:
            update["label_warning"] = warning
        safety = parsed.get("safety_instructions", [])
        if safety:
            update["safety_instructions"] = safety

    elif img_type == "pcb":
        defects = parsed.get("visible_defects", "")
        if defects:
            update["pcb_visible_defects"] = defects
        led = parsed.get("led_status", "")
        if led:
            update["pcb_led_status"] = led

    return update


# =============================================================================
# CLI Interface
# =============================================================================

def main():
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="HVAC Vision Extraction via qwen2.5vl:3b")
    parser.add_argument("--image", "-i", required=True, help="Path to image file or base64 string")
    parser.add_argument("--hint", "-H", action="append", dest="hints",
                        help="Context hint(s) to guide extraction (repeatable)")
    parser.add_argument("--type", "-t", dest="image_type",
                        choices=["display", "nameplate", "label", "wiring", "error_log", "pcb", "unknown"],
                        help="Pre-specified image type (skip detection)")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON")
    parser.add_argument("--state", "-s", action="store_true",
                        help="Output conversation state update")
    args = parser.parse_args()

    # Load image
    image_path = Path(args.image)
    if image_path.exists():
        with open(image_path, "rb") as f:
            img_bytes = f.read()
        b64 = base64.b64encode(img_bytes).decode()
        # Add data URI prefix for Ollama
        mime = "image/jpeg"
        if image_path.suffix.lower() in [".png"]:
            mime = "image/png"
        elif image_path.suffix.lower() in [".webp"]:
            mime = "image/webp"
        b64 = f"data:{mime};base64,{b64}"
    else:
        # Assume it's already base64 (with or without data URI)
        b64 = args.image
        if not b64.startswith("data:"):
            b64 = f"data:image/jpeg;base64,{b64}"

    # Pre-specified type
    img_type_hint = ImageType(args.image_type) if args.image_type else None

    # Run extraction
    result = asyncio.run(extract_from_image(b64, args.hints, img_type_hint))

    if args.state:
        state = state_update_from_vision(result)
        print(json.dumps(state, indent=2, ensure_ascii=False))
    elif args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        # Human-readable output
        print(f"Image type: {result['image_type']}")
        print(f"Model: {result['model']}")
        if result["error"]:
            print(f"ERROR: {result['error']}")
        else:
            print("\n--- Raw Response ---")
            print(result["raw_response"])
            if result["parsed"]:
                print("\n--- Parsed Fields ---")
                parsed = result["parsed"]
                for k, v in parsed.items():
                    print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
