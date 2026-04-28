#!/usr/bin/env python3
"""
HVAC Field Tutor — Enhanced Context Retriever
Provides enriched context for field technicians with procedural steps.

Differences from default RAG:
- top_k=10 (vs 6 default)
- Procedural expansion for safety topics
- Diagnostic flowcharts from error_code chunks
- Safety lockout/tagout steps injection
- Step-by-step procedures format
"""

import os
import re
import json
import httpx
from typing import Optional

# =============================================================================
# Configuration (same as hvac-rag-pipe.py)
# =============================================================================
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
COLLECTION_NAME = "hvac_manuals_v1"

# Field Tutor settings
FIELD_TUTOR_TOP_K = 10
EMBED_TIMEOUT = 60
SEARCH_TIMEOUT = 20

# Safety topics that get enhanced procedural content
SAFETY_TOPICS = {
    "ipm", "inverter board", "placa inverter", "alta tensão", "alta tensão",
    "ponte de diodos", "capacitor", "compressor", "energizado", "lockout", "tagout",
    "link dc", "dc bus", "barramento"
}

ERROR_CODE_PATTERNS = re.compile(
    r'\b(E\d{1,4}|A\d{1,4}|F\d{1,4}|U\d{1,4}|L\d{1,4}|P\d{1,4}|C\d{1,4}|d\d{1,4}|'
    r'Y\d{1,4}|J\d{1,4})\b',
    re.IGNORECASE
)

INSTALLATION_TOPICS = {"instalação", "instalar", "install", "mount", "montagem"}


def qdrant_headers() -> dict:
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}


async def get_embedding(text: str) -> Optional[list]:
    """Get embedding via Ollama."""
    txt = text[:2500]
    async with httpx.AsyncClient(timeout=EMBED_TIMEOUT) as client:
        for attempt in range(2):
            try:
                r = await client.post(
                    f"{OLLAMA_URL}/api/embeddings",
                    headers={"Content-Type": "application/json"},
                    json={"model": EMBEDDING_MODEL, "prompt": txt},
                )
                if r.status_code == 200:
                    data = r.json()
                    emb = data.get("embedding") or data.get("embeddings", [[]])[0]
                    if emb and len(emb) > 0:
                        return emb
            except (httpx.TimeoutException, Exception):
                if attempt == 0:
                    txt = text[:1000]
                    continue
    return None


def extract_filters_from_query(query: str) -> dict:
    """Extract Qdrant filters from query."""
    must_clauses = []

    # Extract model names
    models = re.findall(r'\b[A-Z]{2,10}[0-9]{1,6}[A-Z0-9]*\b', query)
    for m in models[:3]:
        must_clauses.append({"key": "model_candidates", "match": {"value": m.upper()}})

    # Extract error codes
    errors = ERROR_CODE_PATTERNS.findall(query)
    for e in errors[:3]:
        must_clauses.append({"key": "error_code_candidates", "match": {"value": e.upper()}})

    # Prefer service_manual - use should ONLY when must is empty (pure boost mode)
    # Qdrant 1.17: must + should combination can return 0 hits unexpectedly
    if not must_clauses:
        should_clauses = [{"key": "doc_type", "match": {"value": "service_manual"}}]
    else:
        should_clauses = []

    return {"must": must_clauses, "should": should_clauses}


def is_safety_topic(query: str) -> bool:
    """Check if query involves safety-critical topics."""
    q_lower = query.lower()
    return any(topic in q_lower for topic in SAFETY_TOPICS)


def is_error_code_query(query: str) -> bool:
    """Check if query is about error codes."""
    return bool(ERROR_CODE_PATTERNS.search(query))


def is_installation_query(query: str) -> bool:
    """Check if query is about installation."""
    q_lower = query.lower()
    return any(topic in q_lower for topic in INSTALLATION_TOPICS)


async def search_qdrant(query: str, top_k: int = FIELD_TUTOR_TOP_K) -> list:
    """Search Qdrant with enhanced retrieval."""
    emb = await get_embedding(query)
    if not emb:
        return []

    filters = extract_filters_from_query(query)
    must_clauses = filters.get("must", [])
    should_clauses = filters.get("should", [])

    # Build filter - use must if available, should is additive
    if must_clauses or should_clauses:
        filter_body = {}
        if must_clauses:
            filter_body["must"] = must_clauses
        if should_clauses:
            filter_body["should"] = should_clauses
    else:
        filter_body = None

    search_payload = {
        "vector": emb,
        "top": top_k,
        "with_payload": True,
    }
    if filter_body:
        search_payload["filter"] = filter_body

    async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT) as client:
        try:
            r = await client.post(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search",
                headers=qdrant_headers(),
                json=search_payload,
            )
            if r.status_code == 200:
                return r.json().get("result", [])
        except Exception:
            pass
    return []


def build_standard_context(hits: list, max_chars: int = 7000) -> str:
    """Build standard context from hits."""
    if not hits:
        return "[Nenhum trecho encontrado na base HVAC]"

    chunks = []
    total_len = 0

    for i, hit in enumerate(hits):
        payload = hit.get("payload", {})
        doc_type = payload.get("doc_type", "")
        heading = payload.get("heading", "")
        doc_id = payload.get("doc_id", "")
        models = payload.get("model_candidates", [])
        error_codes = payload.get("error_code_candidates", [])
        safety_tags = payload.get("safety_tags", [])
        text = payload.get("text", "")[:800]

        chunk = f"[Trecho {i + 1}]"
        if doc_id:
            chunk += f" Manual: {doc_id}"
        if heading:
            chunk += f" | Seção: {heading}"
        if doc_type:
            chunk += f" | Tipo: {doc_type}"
        if models:
            chunk += f" | Modelos: {', '.join(models[:3])}"
        if error_codes:
            chunk += f" | Erros: {', '.join(error_codes[:5])}"
        if safety_tags:
            chunk += f" | ⚠️ {', '.join(safety_tags[:3])}"
        chunk += f"\n{text}"

        if total_len + len(chunk) > max_chars:
            remaining = max_chars - total_len
            if remaining > 100:
                chunk = chunk[:remaining] + "…"
                chunks.append(chunk)
            break

        chunks.append(chunk)
        total_len += len(chunk)

    return "\n\n".join(chunks)


def build_safety_procedure(enriched_hits: list) -> str:
    """Build enhanced safety procedure section from hits."""
    sections = []

    # Safety lockout/tagout procedure — PROCEDIMENTO GERAL DE SEGURANÇA
    sections.append("""⚠️ PROCEDIMENTO GERAL DE SEGURANÇA — ALTA TENSÃO

Antes de qualquer intervenção em componentes de alta tensão:

1. DESLIGAR a unidade da rede elétrica (tomada ou disjuntor dedicado)
2. AGUARDAR o tempo de descarga especificado no manual do fabricante, na etiqueta da unidade ou na placa de identificação — e confirmar ausência de tensão com multímetro adequado antes de tocar qualquer componente
3. Aplicar cadeado e etiqueta de bloqueio no disjuntor
4. Usar EPIs adequados: luvas isolantes classe III ou superior, óculos de proteção, calçado isolante
5. NUNCA realizar medições energizadas sem respaldo explícito do manual do fabricante""")

    # Find safety-specific hits and add them
    safety_content = []
    for hit in enriched_hits:
        payload = hit.get("payload", {})
        safety_tags = payload.get("safety_tags", [])
        if safety_tags or "safety" in payload.get("doc_type", "").lower():
            text = payload.get("text", "")[:400]
            if text:
                safety_content.append(f"[Do manual] {text[:400]}...")

    if safety_content:
        sections.append("📖 TRECHOS DE SEGURANÇA DOS MANUAIS:\n" + "\n".join(safety_content[:3]))

    return "\n\n".join(sections)


def build_error_code_flowchart(hits: list) -> str:
    """Build diagnostic flowchart from error code chunks."""
    error_chunks = []

    for hit in hits:
        payload = hit.get("payload", {})
        error_codes = payload.get("error_code_candidates", [])
        if error_codes:
            text = payload.get("text", "")[:600]
            if text:
                error_chunks.append(f"[Erro {', '.join(error_codes[:3])}]\n{text[:600]}")

    if not error_chunks:
        return ""

    flowchart = "\n\n📊 FLUXO DE DIAGNÓSTICO POR CÓDIGO DE ERRO:\n"
    flowchart += "\n---\n".join(error_chunks[:3])
    return flowchart


def build_installation_checklist(hits: list) -> str:
    """Build pre-installation checklist from hits."""
    install_chunks = []

    for hit in hits:
        payload = hit.get("payload", {})
        text = payload.get("text", "")[:500]
        if text and ("instalação" in text.lower() or "install" in text.lower()):
            install_chunks.append(text[:500])

    if not install_chunks:
        return ""

    checklist = "\n\n✅ CHECKLIST PRÉ-INSTALAÇÃO:\n"
    for i, chunk in enumerate(install_chunks[:2], 1):
        checklist += f"\n{i}. {chunk[:300]}..."
    return checklist


def build_field_tutor_context(query: str, hits: list) -> str:
    """
    Build enhanced context for field tutor mode.

    Adds:
    - Safety procedure when query involves safety topics
    - Error code flowchart when query has error codes
    - Installation checklist when query is about installation
    - Standard context from all hits
    """
    if not hits:
        return "[Nenhum trecho encontrado na base HVAC - forneça modelo completo para busca]"

    # Build base context
    base_context = build_standard_context(hits, max_chars=5000)

    sections = [base_context]

    # Add safety procedure if applicable
    if is_safety_topic(query):
        sections.append(build_safety_procedure(hits))

    # Add error code flowchart if applicable
    if is_error_code_query(query):
        sections.append(build_error_code_flowchart(hits))

    # Add installation checklist if applicable
    if is_installation_query(query):
        sections.append(build_installation_checklist(hits))

    return "\n\n---\n\n".join(sections)


# =============================================================================
# CLI Interface
# =============================================================================

async def field_tutor_query(query: str) -> str:
    """Execute field tutor query and return enriched context."""
    hits = await search_qdrant(query, top_k=FIELD_TUTOR_TOP_K)
    context = build_field_tutor_context(query, hits)
    return context


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="HVAC Field Tutor")
    parser.add_argument("--query", "-q", required=True, help="Query to expand")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    hits = await search_qdrant(args.query, top_k=FIELD_TUTOR_TOP_K)
    context = build_field_tutor_context(args.query, hits)

    if args.json:
        print(json.dumps({
            "query": args.query,
            "hits_count": len(hits),
            "is_safety_topic": is_safety_topic(args.query),
            "is_error_code": is_error_code_query(args.query),
            "is_installation": is_installation_query(args.query),
            "context": context
        }, indent=2, ensure_ascii=False))
    else:
        print(f"=== FIELD TUTOR CONTEXT ===")
        print(f"Query: {args.query}")
        print(f"Hits: {len(hits)}")
        print(f"Safety topic: {is_safety_topic(args.query)}")
        print(f"Error code: {is_error_code_query(args.query)}")
        print(f"Installation: {is_installation_query(args.query)}")
        print(f"\n=== CONTEXT ===\n{context}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
