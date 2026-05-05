#!/usr/bin/env python3
"""
HVAC Cross-Check Agent — Nexus Analytical

Validates LLM responses against retrieved source chunks before display.
Prevents hallucinations by verifying factual claims exist in the manual context.

Two modes:
  - fast (default): rule-based regex matching, <5ms
  - llm: second LLM pass via LiteLLM for semantic validation (adds ~2s)

Set HVAC_CROSSCHECK_MODE=llm to enable LLM mode.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from typing import Optional

log = logging.getLogger("hvac-crosscheck")

CROSSCHECK_MODE = os.environ.get("HVAC_CROSSCHECK_MODE", "fast")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4018/v1")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY", "sk-dummy")
CROSSCHECK_MODEL = os.environ.get("HVAC_CROSSCHECK_MODEL", "groq/llama-3.3-70b-versatile")
CROSSCHECK_TIMEOUT = float(os.environ.get("HVAC_CROSSCHECK_TIMEOUT", "8"))

# Technical value patterns that must be verifiable in source chunks
_TECH_VALUE_RE = re.compile(
    r'\b(\d+(?:[.,]\d+)?\s*(?:V|VAC|VDC|A|mA|Ω|ohm|bar|psi|Hz|kPa|°C|°F|BTU|W|kW|RPM))\b',
    re.IGNORECASE,
)
_ERROR_CODE_CLAIM_RE = re.compile(
    r'\b([EAFULPCd]\d{1,4}(?:[-–]\d{1,4})?)\b',
    re.IGNORECASE,
)
_PAGE_CITE_RE = re.compile(
    r'\bpág(?:ina)?\.?\s*(\d+)\b',
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    return re.sub(r'[^\w]', '', text.lower())


def _chunks_corpus(chunks: list[dict]) -> str:
    return " ".join(_normalize(c.get("text", "")) for c in chunks)


# ---------------------------------------------------------------------------
# Fast rule-based validator
# ---------------------------------------------------------------------------

def _fast_validate(response_text: str, chunks: list[dict]) -> dict:
    """Rule-based: check that technical values/error codes mentioned in
    the response actually appear in at least one source chunk."""
    corpus = _chunks_corpus(chunks)
    audit: list[dict] = []
    unsupported: list[str] = []

    for pat, label in (
        (_TECH_VALUE_RE, "technical_value"),
        (_ERROR_CODE_CLAIM_RE, "error_code"),
    ):
        for m in pat.finditer(response_text):
            claim = m.group(0)
            found = _normalize(claim) in corpus
            audit.append({"type": label, "claim": claim, "found_in_source": found})
            if not found:
                unsupported.append(claim)

    total = len(audit)
    supported = sum(1 for a in audit if a["found_in_source"])
    confidence = supported / total if total > 0 else 1.0

    return {
        "mode": "fast",
        "valid": len(unsupported) == 0,
        "confidence": round(confidence, 3),
        "unsupported_claims": unsupported,
        "audit_trail": audit,
        "recommendation": "APPROVE" if len(unsupported) == 0 else "FLAG",
    }


# ---------------------------------------------------------------------------
# LLM-based validator (Nexus Analytical second pass)
# ---------------------------------------------------------------------------

def _build_crosscheck_prompt(response_text: str, chunks: list[dict]) -> str:
    chunk_excerpts = []
    for i, c in enumerate(chunks[:4], 1):
        doc_id = c.get("doc_id", "?")
        heading = c.get("heading", "")
        page = c.get("page_start", "?")
        text = c.get("text", "")[:400]
        chunk_excerpts.append(f"[Trecho {i}] {doc_id} | Seção: {heading} | Pág: {page}\n{text}")

    manual_ctx = "\n\n".join(chunk_excerpts) if chunk_excerpts else "[nenhum trecho recuperado]"

    return f"""Você é o Nexus Analytical, agente de validação técnica HVAC.

Sua tarefa: verificar se a resposta abaixo está 100% suportada pelos trechos do manual.

TRECHOS DO MANUAL:
{manual_ctx}

RESPOSTA PROPOSTA:
{response_text[:800]}

Verifique apenas fatos técnicos verificáveis:
- Valores numéricos (tensão, pressão, corrente, frequência)
- Códigos de erro (E1, F2, A3, etc.)
- Afirmações de procedimento específico ("desligar antes de medir", etc.)

Responda APENAS com JSON válido, sem markdown:
{{"valid": true/false, "issues": ["lista de problemas, vazia se nenhum"], "recommendation": "APPROVE" ou "FLAG"}}"""


async def _llm_validate(response_text: str, chunks: list[dict]) -> dict:
    """LLM-based cross-validation via LiteLLM."""
    try:
        import httpx
    except ImportError:
        log.warning("httpx not available for LLM crosscheck — falling back to fast mode")
        return _fast_validate(response_text, chunks)

    prompt = _build_crosscheck_prompt(response_text, chunks)

    async with httpx.AsyncClient(timeout=CROSSCHECK_TIMEOUT) as client:
        try:
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LITELLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": CROSSCHECK_MODEL,
                    "messages": [
                        {"role": "system", "content": "Você é um validador técnico HVAC. Responda apenas com JSON válido."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.0,
                    "max_tokens": 256,
                },
            )
            if r.status_code == 200:
                raw = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                # Strip markdown code blocks if present
                raw = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.MULTILINE)
                raw = re.sub(r'```\s*$', '', raw.strip(), flags=re.MULTILINE)
                parsed = json.loads(raw.strip())
                return {
                    "mode": "llm",
                    "valid": bool(parsed.get("valid", True)),
                    "confidence": 1.0 if parsed.get("valid", True) else 0.5,
                    "unsupported_claims": [],
                    "issues": parsed.get("issues", []),
                    "audit_trail": [],
                    "recommendation": parsed.get("recommendation", "APPROVE"),
                }
        except (json.JSONDecodeError, Exception) as exc:
            log.warning(f"LLM crosscheck failed ({type(exc).__name__}) — falling back to fast mode")

    return _fast_validate(response_text, chunks)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def validate_response(
    response_text: str,
    chunks: list[dict],
    mode: Optional[str] = None,
) -> dict:
    """
    Validate that claims in response_text are supported by retrieved chunks.

    Args:
        response_text: The LLM-generated response to validate.
        chunks: List of Qdrant payload dicts (manual context chunks).
        mode: "fast" or "llm". Defaults to HVAC_CROSSCHECK_MODE env var.

    Returns dict with: valid, confidence, unsupported_claims, recommendation.
    """
    if not chunks or not response_text:
        return {
            "mode": "skip",
            "valid": True,
            "confidence": 1.0,
            "unsupported_claims": [],
            "audit_trail": [],
            "recommendation": "APPROVE",
        }

    effective_mode = mode or CROSSCHECK_MODE
    t0 = time.monotonic()

    if effective_mode == "llm":
        result = await _llm_validate(response_text, chunks)
    else:
        result = _fast_validate(response_text, chunks)

    result["latency_ms"] = round((time.monotonic() - t0) * 1000, 1)
    return result


def build_audit_trail(
    query: str,
    response_text: str,
    chunks: list[dict],
    crosscheck_result: Optional[dict] = None,
) -> dict:
    """
    Build a structured audit trail for compliance logging.

    Logs which manual sources were consulted and whether the response
    was validated. Does NOT log raw query text (privacy).
    """
    query_hash = hashlib.sha256(query.encode()).hexdigest()[:12]

    sources = []
    for c in chunks:
        sources.append({
            "doc_id": c.get("doc_id", "unknown"),
            "heading": c.get("heading", ""),
            "page_start": c.get("page_start"),
            "page_end": c.get("page_end"),
            "doc_type": c.get("doc_type", ""),
            "error_codes": c.get("error_code_candidates", [])[:5],
        })

    return {
        "query_hash": query_hash,
        "sources_consulted": sources,
        "source_count": len(sources),
        "has_exact_manual": any(c.get("doc_type") == "service_manual" for c in chunks),
        "crosscheck": crosscheck_result or {},
        "response_len": len(response_text),
    }


def format_citations(chunks: list[dict]) -> list[dict]:
    """
    Extract citation metadata from source chunks for display in the UI.

    Returns list of {doc_id, heading, page_start} for [Manual X, pág Y] links.
    """
    seen: set[str] = set()
    citations = []
    for c in chunks:
        doc_id = c.get("doc_id", "")
        page = c.get("page_start")
        heading = c.get("heading", "")
        key = f"{doc_id}:{page}"
        if key not in seen and doc_id:
            seen.add(key)
            citations.append({
                "doc_id": doc_id,
                "heading": heading,
                "page_start": page,
                "page_end": c.get("page_end"),
                "doc_type": c.get("doc_type", ""),
            })
    return citations[:6]
