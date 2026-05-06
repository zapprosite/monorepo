#!/usr/bin/env python3
"""Generate structured HVAC FAQ pairs from a Markdown manual."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


FAQ_PROMPT = """Você é um técnico sênior de HVAC.
Extraia perguntas e respostas técnicas do manual abaixo.

Regras:
- Responda apenas JSON válido.
- Use este formato: [{"question": "...", "answer": "...", "source_excerpt": "..."}]
- Não invente valores, procedimentos ou códigos ausentes do trecho.
- Faça perguntas práticas de campo sobre diagnóstico, segurança, códigos de erro e componentes.
- Gere no máximo {limit} pares.

Manual:
---
{text}
---
"""


def build_faq_prompt(markdown_text: str, limit: int = 50) -> str:
    return FAQ_PROMPT.format(text=markdown_text[:12000], limit=limit)


def parse_faq_json(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    normalized = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        if question and answer:
            normalized.append(
                {
                    "question": question,
                    "answer": answer,
                    "source_excerpt": str(item.get("source_excerpt", ""))[:500],
                }
            )
    return normalized


def generate_with_nexus_cli(markdown_text: str, limit: int = 50) -> list[dict]:
    prompt = build_faq_prompt(markdown_text, limit=limit)
    try:
        completed = subprocess.run(
            ["nexus", "run", "-d", prompt],
            check=False,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except Exception:
        return []
    if completed.returncode != 0:
        return []
    return parse_faq_json(completed.stdout)


def fallback_extractive_faq(markdown_text: str, limit: int = 50) -> list[dict]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", markdown_text) if len(p.strip()) > 80]
    keywords = ("erro", "sensor", "compressor", "placa", "inverter", "tensão", "segurança", "diagnóstico")
    selected = [p for p in paragraphs if any(keyword in p.lower() for keyword in keywords)]
    pairs = []
    for idx, paragraph in enumerate(selected[:limit], 1):
        excerpt = re.sub(r"\s+", " ", paragraph)[:500]
        pairs.append(
            {
                "question": f"Qual informação técnica o manual traz no trecho {idx}?",
                "answer": excerpt,
                "source_excerpt": excerpt,
            }
        )
    return pairs


def generate_faq(markdown_text: str, limit: int = 50, use_nexus_cli: bool = False) -> list[dict]:
    if use_nexus_cli:
        generated = generate_with_nexus_cli(markdown_text, limit=limit)
        if generated:
            return generated[:limit]
    return fallback_extractive_faq(markdown_text, limit=limit)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate structured HVAC FAQ JSON from Markdown")
    parser.add_argument("input", type=Path, help="Markdown manual path")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--use-nexus-cli", action="store_true")
    args = parser.parse_args()

    markdown_text = args.input.read_text(encoding="utf-8")
    print(json.dumps(generate_faq(markdown_text, args.limit, args.use_nexus_cli), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
