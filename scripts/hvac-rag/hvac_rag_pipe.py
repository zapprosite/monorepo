#!/usr/bin/env python3
"""
HVAC RAG Pipe — OpenWebUI OpenAI-Compatible RAG Pipe
Provides OpenAI-compatible /v1/chat/completions endpoint that:
  1. Extracts model/error_code from query
  2. Embeds via Ollama (nomic-embed-text)
  3. Searches Qdrant hvac_manuals_v1 with smart filters
  4. Injects context into the system prompt
  5. Forwards enriched request to LiteLLM
  6. Returns response to OpenWebUI
Also provides pipeline filter endpoints for OpenWebUI native filter integration.
"""

import asyncio
import hashlib
import os
import re
import json
import logging
import sys
import importlib.util
from typing import Optional

# Import local modules using importlib (files use hyphens, not underscores)
def import_local_module(name: str, filename: str):
    """Import a local module from the same directory."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(os.path.dirname(__file__), filename))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

# Import Juiz module
_juez_mod = import_local_module("hvac_juiz", "hvac_juiz.py")
JuizResult = _juez_mod.JuizResult
juiz = _juez_mod.judge

# Import Field Tutor module
_ft_mod = import_local_module("hvac_field_tutor", "hvac_field_tutor.py")

# Import Formatter module
_fmt_mod = import_local_module("hvac_formatter", "hvac_formatter.py")

# Import Friendly Response Rewriter
_fr_mod = import_local_module("hvac_friendly_response", "hvac-friendly-response.py")
rewrite_response = _fr_mod.rewrite_response
rewrite_blocked = _fr_mod.rewrite_blocked_response
rewrite_ask = _fr_mod.rewrite_ask_clarification_response

# Memory context — context_fetch + memory_writeback + state extraction
_mem_ctx_mod = import_local_module("hvac_memory_context", "hvac_memory_context.py")
context_fetch = _mem_ctx_mod.context_fetch
memory_writeback = _mem_ctx_mod.memory_writeback
build_context_pack = _mem_ctx_mod.build_context_pack
memory_health_summary = _mem_ctx_mod.memory_health_summary
extract_state_from_messages = _mem_ctx_mod.extract_state_from_messages
merge_state = _mem_ctx_mod.merge_state
state_sufficient_for_diagnosis = _mem_ctx_mod.state_sufficient_for_diagnosis
state_sufficient_for_triage = _mem_ctx_mod.state_sufficient_for_triage

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# =============================================================================
# Configuration
# =============================================================================
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4000/v1")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY", "sk-dummy")
COLLECTION_NAME = "hvac_manuals_v1"

# Public model name exposed to OpenWebUI
MODEL_NAME = "zappro-clima-tutor"

# Internal model aliases (not exposed publicly — used by router internally)
INTERNAL_MODELS = ["hvac-manual-strict", "hvac-field-tutor", "hvac-printable"]

PIPELINE_PORT = int(os.environ.get("PIPELINE_PORT", "4017"))
PIPELINE_HOST = os.environ.get("PIPELINE_HOST", "127.0.0.1")

# Limits
DEFAULT_TOP_K = 6
MAX_CONTEXT_CHARS = 7000
EMBED_TIMEOUT = 60
SEARCH_TIMEOUT = 20
WEB_SEARCH_TIMEOUT = 15
CHAT_TIMEOUT = 120

# MiniMax primary model for final answer formatting
PRIMARY_LLM_MODEL = "minimax-m2.7"

# HVAC domain keywords — out-of-domain queries are blocked
HVAC_COMPONENTS = {
    "inversor", "inverter", "ipm", "pcb", "placa", "compressor", "ventilador",
    "capacitor", "capacitor de partida", "sensor", "termistor", "válvula",
    "serpentina", "evaporador", "condensador", "filtro", "desidratador",
    "tubulação", "carga de gás", "refrigerante", "bitzer", "copeland",
    "danfoss", "carrier", "midea", "lg", "samsung", "daikin", "gree",
    "chiller", "vrv", "cassete", "piso", "teto", "hi-wall", "ar-condicionado",
    "split", "window", "portátil", "deumidificador", "umidificador",
}
HVAC_ERROR_CODES = re.compile(
    r'\b(E\d{1,4}|A\d{1,4}|F\d{1,4}|U\d{1,4}|L\d{1,4}|P\d{1,4}|C\d{1,4}|d\d{1,4}|'
    r'Y\d{1,4}|J\d{1,4})\b',
    re.IGNORECASE
)
HVAC_MODEL_PATTERNS = re.compile(
    r'\b(RXYQ|RYYQ|FXMQ|FXAQ|FXCQ|FXEQ|FXKQ|FXFQ|FXFRQ|FXFSQ|FXFTQ|FXDQ|FXPQ|FXVQ|'
    r'BRC1|BRC2|BRC3|BRC4|RKXY|RCXY|RAXY|RGXY|AHZ|ANH|AG|HXY|CXY)\b',
    re.IGNORECASE
)
OUT_OF_DOMAIN_REJECT = [
    "geladeira", "refrigerador", "freezer", "frost free",
    "televisão", "tv", "smart tv", "monitor", "notebook", "celular",
    "telefone", "computador", "desktop", "máquina de lavar", "lavadora",
    "secadora", "fogão", "cooktop", "forno", "micro-ondas",
    "automóvel", "carro", "moto", "caminhão",
    "shampoo", "medicamento", "receita", "remédio",
    "bolo", "chocolate", "comida", "alimento", "bebida",
    "futebol", "esporte", "cinema", "filme", "série",
    "notícia", "jornal", "política", "religião",
    "bla", "test", "testing", "asdf", "qwerty",
]

# =============================================================================
# Logging
# =============================================================================
log = logging.getLogger("hvac-rag-pipe")
logging.basicConfig(
    level=logging.INFO,
    format="[HVAC-RAG] %(levelname)s %(message)s",
)

# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(title="HVAC RAG Pipe", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Helpers
# =============================================================================

def qdrant_headers() -> dict:
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}


def litellm_headers() -> dict:
    return {"Authorization": f"Bearer {LITELLM_API_KEY}", "Content-Type": "application/json"}


def _safe_log(msg: str) -> None:
    """Log without exposing secrets or raw query content."""
    log.info(msg)


def _build_safe_fallback_response(context: str, user_query: str, request_id: str = "") -> dict:
    """
    Build a safe fallback response when LiteLLM is unavailable.
    Returns structured response with context, not a raw 502.
    """
    if context:
        # Has context — return structured response with recovered context
        fallback_text = (
            "Contexto recuperado da base HVAC, mas o modelo de linguagem não está disponível no momento.\n\n"
            "=== INFORMAÇÕES TÉCNICAS RECUPERADAS ===\n\n"
            f"{context[:3000]}\n\n"
            "=========================================\n\n"
            "Nota: Para assistência com interpretação destas informações, "
            "tente novamente em alguns momentos quando o sistema estiver disponível.\n"
            f"ID: {request_id or 'n/a'}"
        )
    else:
        fallback_text = (
            "Contexto recuperado, mas modelo de linguagem indisponível.\n"
            "Tente novamente em alguns momentos.\n"
            f"ID: {request_id or 'n/a'}"
        )

    return {
        "id": "hvac-chat-completion",
        "object": "chat.completion",
        "created": 0,
        "model": MODEL_NAME,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": fallback_text,
                },
                "finish_reason": "stop",
            }
        ],
        "fallback": True,
        "request_id": request_id,
    }


def _log_query_meta(query: str, extra: dict = None) -> str:
    """
    Log query metadata without exposing raw query text.
    Returns a safe log string with hash, length, and category.
    """
    q_hash = hashlib.sha256(query.encode()).hexdigest()[:8]
    q_len = len(query)
    q_category = "safety" if any(k in query.lower() for k in ["ipm", "alta tensão", "inverter", "capacitor"]) else "standard"
    base = f"q_hash={q_hash} q_len={q_len} q_cat={q_category}"
    if extra:
        base += " " + " ".join(f"{k}={v}" for k, v in extra.items())
    return base


async def get_embedding(text: str) -> Optional[list]:
    """Get embedding via Ollama with timeout and retry."""
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
            except httpx.TimeoutException:
                if attempt == 0:
                    txt = text[:1000]
                    continue
            except Exception:
                if attempt == 0:
                    txt = text[:1000]
                    continue
    return None


def extract_filters_from_query(query: str) -> dict:
    """Extract Qdrant filters from natural language query."""
    must_clauses = []
    should_clauses = []

    # Extract model names - use must for strict matching
    models = HVAC_MODEL_PATTERNS.findall(query)
    for m in models[:3]:
        must_clauses.append({"key": "model_candidates", "match": {"value": m.upper()}})

    # Extract error codes - use must for strict matching
    errors = HVAC_ERROR_CODES.findall(query)
    for e in errors[:3]:
        must_clauses.append({"key": "error_code_candidates", "match": {"value": e.upper()}})

    # Boost service_manual via should (only when no must clauses)
    if not must_clauses:
        should_clauses.append({"key": "doc_type", "match": {"value": "service_manual"}})

    return {"must": must_clauses, "should": should_clauses}


def is_out_of_domain(query: str) -> bool:
    """Check if query is clearly outside HVAC domain."""
    q_lower = query.lower()
    for term in OUT_OF_DOMAIN_REJECT:
        if term in q_lower:
            return True
    return False


async def search_qdrant(query: str, top_k: int = DEFAULT_TOP_K) -> list:
    """Search Qdrant with intelligent filters."""
    emb = await get_embedding(query)
    if not emb:
        return []

    filters = extract_filters_from_query(query)
    should_clauses = filters.get("should", [])
    must_clauses = filters.get("must", [])

    # Build filter body - Qdrant 1.17: must + should without minimum_should_match
    # Use should ONLY when must is empty (pure boost mode)
    if must_clauses:
        filter_body = {"must": must_clauses}
    elif should_clauses:
        filter_body = {"should": should_clauses}
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
        except httpx.TimeoutException:
            _safe_log("Qdrant search timeout")
        except Exception as e:
            _safe_log(f"Qdrant search error: {type(e).__name__}")
    return []


async def search_web_ddg(query: str) -> list:
    """
    Fallback web search using DuckDuckGo Lite HTML.
    Returns list of dicts with {title, url, snippet}.
    """
    import re as _re
    try:
        import urllib.parse
        encoded_q = urllib.parse.quote(query)
        ddg_url = f"https://lite.duckduckgo.com/lite/?q={encoded_q}&kl=br-pt"
        async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
            r = await client.get(ddg_url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
            })
            if r.status_code != 200:
                _safe_log(f"[web-search] DDG HTTP {r.status_code}")
                return []
            text = r.text
        results = []
        # DuckDuckGo Lite: results are in <a class="result-link" href="...">title</a>
        # followed by <td class="result-snippet">snippet</td>
        for match in _re.finditer(r'<a class="result-link" href="([^"]+)"[^>]*>([^<]+)</a>', text):
            url = match.group(1)
            title = _re.sub(r'<[^>]+>', '', match.group(2)).strip()
            # Find the snippet in the next td
            snippet_pos = match.end()
            snippet_match = _re.search(r'<td class="result-snippet">([^<]+)</td>', text[snippet_pos:snippet_pos+500])
            snippet = _re.sub(r'<[^>]+>', '', (snippet_match.group(1) if snippet_match else ''))[:300].strip()
            if title and url:
                results.append({"title": title, "url": url, "snippet": snippet})
            if len(results) >= 5:
                break
        _safe_log(f"[web-search] DDG returned {len(results)} results for query: {query[:60]}")
        return results
    except Exception as e:
        _safe_log(f"[web-search] DDG error: {type(e).__name__}: {e}")
        return []


def build_rag_context(hits: list, max_chars: int = MAX_CONTEXT_CHARS) -> str:
    """Build truncated context string from Qdrant hits."""
    if not hits:
        return ""

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


# =============================================================================
# System Prompt Template — Zappro Clima Tutor
# =============================================================================

SYSTEM_PROMPT_TEMPLATE = """Você é o Zappro Clima Tutor, um assistente amigável de climatização inverter.

TOM:
- Estilo ChatGPT, não laudo técnico
- Paciente, claro, direto
- Uma pergunta simples por vez
- Não pareça formulário
- Não exponha rótulos internos

ESTRUTURA DE RESPOSTA:
1. Entendi o cenário — reconheça o que o usuário já informou
2. Pista principal — explique o caminho provável
3. Como pensar — dê ordem lógica sem cravar peça cedo
4. Segurança — alerte se envolver placa/IPM/compressor/alta tensão/capacitor/barramento DC
5. Próximo passo — uma única pergunta no final

NUNCA:
- Não diga apenas "não encontrei no manual" e pare — diga "não tenho o manual exato, então trato como triagem técnica"
- Não mostre rótulos internos como "Graph interno", "Evidência:"
- Troque por: "Pela triagem técnica...", "Pela base técnica...", "Pelo manual..."
- Não invente valores de tensão, resistência, pressão, corrente ou carga de gás
- Não oriente medição energizada sem respaldo explícito do manual
- Não peça "modelo completo" repetidamente se o usuário já deu marca/família/código
- Não termine com checklist de segurança como última frase — integre na resposta

CONTEXTO HVAC RECUPERADO:
{context}

---
Responda em português do Brasil. Se não há contexto relevante, diga que não encontrou de forma amigável."""


FIELD_TUTOR_SYSTEM_PROMPT = """Você é o Zappro Clima Tutor, modo técnico de campo.

TOM:
- Estilo ChatGPT, mas com profundidade técnica
- Paciente, claro, direto
- Uma pergunta por vez
- Estrutura: Entendi / Caminho provável / Diagnóstico passo a passo / Segurança / Pergunta simples

NUNCA:
- Não mostre "Graph interno", "Evidência:" — use "Pela triagem técnica"
- Não invente valores de tensão, resistência, pressão, corrente ou carga de gás
- Não oriente medição energizada sem respaldo explícito do manual
- Não crave peça antes de esgotar diagnóstico

PARA ALTA TENSÃO, IPM, PLACA INVERTER, COMPRESSOR, CAPACITOR, BARRAMENTO DC:
- AVISO DE SEGURANÇA curto e integrado na resposta
- Indique seguir o manual do modelo específico
- Recomende técnico qualificado

IDIOMA: Responda SOMENTE em português do Brasil. Não use caracteres CJK, Cirílicos ou alfabetos não-latinos.

CONTEXTO HVAC EXPANDIDO:
{context}

---
Responda em português do Brasil."""


# =============================================================================
# Retrieval Package Builder
# =============================================================================

def build_retrieval_package(user_query: str, hits: list, juiz_meta: dict,
                             memory_context: Optional[dict] = None,
                             memory_context_str: str = "",
                             merged_state: Optional[dict] = None) -> dict:
    """
    Build a structured retrieval package for MiniMax to format the final answer.

    The package contains all context MiniMax needs to write a good response,
    replacing the old pattern of returning raw RAG chunks + fixed prompt.
    """
    pkg = {
        "user_query": user_query,
        "conversation_state": {},
        "manual_context": [],
        "web_context": [],
        "evidence_level": "nenhum",
        "safety_flags": [],
        "missing_info": [],
        "next_best_question": None,
        "memory_context": memory_context or {},
        "memory_context_str": memory_context_str,
    }

    # Extract conversation state from merged_state (priority: current messages > long-term memory)
    if merged_state:
        ms = merged_state
        if ms.get("brand"):
            pkg["conversation_state"]["brand"] = ms["brand"]
        if ms.get("family"):
            pkg["conversation_state"]["family"] = ms["family"]
        if ms.get("alarm_code"):
            pkg["conversation_state"]["alarm_code"] = ms["alarm_code"]
        if ms.get("subcode"):
            pkg["conversation_state"]["subcode"] = ms["subcode"]
        if ms.get("outdoor_model"):
            pkg["conversation_state"]["outdoor_model"] = ms["outdoor_model"]
        if ms.get("indoor_model"):
            pkg["conversation_state"]["indoor_model"] = ms["indoor_model"]
        if ms.get("display_type"):
            pkg["conversation_state"]["display_type"] = ms["display_type"]
        if ms.get("all_codes"):
            pkg["conversation_state"]["all_codes"] = ms["all_codes"]
        if ms.get("all_models"):
            pkg["conversation_state"]["all_models"] = ms["all_models"]
        if ms.get("safety_flags"):
            pkg["safety_flags"] = list(set(pkg["safety_flags"]) | set(ms["safety_flags"]))
        if ms.get("outdoor_model") or ms.get("indoor_model"):
            pkg["conversation_state"]["has_model"] = True

    # Also extract from juí z metadata (fallback for current query only)
    if juiz_meta.get("has_complete_model"):
        pkg["conversation_state"]["has_model"] = True
    if juiz_meta.get("has_error_codes"):
        errors = HVAC_ERROR_CODES.findall(user_query)
        if errors and not pkg["conversation_state"].get("all_codes"):
            pkg["conversation_state"]["error_codes"] = errors[:3]
    if juiz_meta.get("has_hvac_components"):
        pkg["safety_flags"] = list(
            set(pkg["safety_flags"]) | set(k for k in SAFETY_KEYWORDS if k in user_query.lower())
        )

    # Build manual context from Qdrant hits
    for hit in hits[:6]:
        payload = hit.get("payload", {})
        pkg["manual_context"].append({
            "doc_id": payload.get("doc_id", ""),
            "heading": payload.get("heading", ""),
            "doc_type": payload.get("doc_type", ""),
            "models": payload.get("model_candidates", [])[:3],
            "error_codes": payload.get("error_code_candidates", [])[:5],
            "safety_tags": payload.get("safety_tags", []),
            "text": payload.get("text", "")[:600],
        })

    # Determine evidence level
    if pkg["manual_context"]:
        doc_types = {c["doc_type"] for c in pkg["manual_context"] if c["doc_type"]}
        if "service_manual" in doc_types:
            pkg["evidence_level"] = "manual_exato"
        else:
            pkg["evidence_level"] = "manual_familia"
    elif juiz_meta.get("has_error_codes") or juiz_meta.get("has_hvac_components"):
        pkg["evidence_level"] = "triagem_tecnica"
    else:
        pkg["evidence_level"] = "sem_contexto"

    # Determine missing info and next best question
    if not pkg["conversation_state"].get("has_model") and not juiz_meta.get("has_complete_model"):
        pkg["missing_info"].append("modelo_ou_codigo")
        if juiz_meta.get("has_error_codes"):
            pkg["next_best_question"] = (
                "o código que aparece no display? "
                "Pode ser algo como U4-01, E4-01 ou A3."
            )
        else:
            pkg["next_best_question"] = (
                "o que aparece no display ou na etiqueta da unidade externa? "
                "Exemplo: um código como U4-01 ou um modelo como RXYQ20BRA."
            )

    return pkg


def build_minimax_system_prompt(pkg: dict) -> str:
    """
    Build the system prompt sent to MiniMax for final answer formatting.
    MiniMax receives structured context and formats it as a friendly tutor response.
    """
    lines = [
        "Você é o Zappro Clima Tutor — assistente amigável de climatização inverter.",
        "",
        "TOM: estilo ChatGPT, paciente, claro, direto, uma pergunta por vez, não formulário.",
        "",
        "ESTRUTURA:",
        "1. Entendi o cenário — reconheça o que o usuário já informou",
        "2. Pista principal — caminho provável",
        "3. Como pensar — ordem lógica sem cravar peça cedo",
        "4. Segurança — alerta integrado se envolver alta tensão, placa, IPM, compressor, capacitor, barramento DC",
        "5. Próximo passo — UMA única pergunta no final",
        "",
    ]

    # Add conversation state (reconhecer o que o usuário já informou na conversa)
    state = pkg.get("conversation_state", {})
    state_parts = []
    if state.get("brand"):
        state_parts.append(f"marca: {state['brand']}")
    if state.get("family"):
        state_parts.append(f"família: {state['family']}")
    if state.get("subcode"):
        state_parts.append(f"código: {state['subcode']}")
    elif state.get("alarm_code"):
        state_parts.append(f"código: {state['alarm_code']}")
    if state.get("outdoor_model"):
        state_parts.append(f"modelo externo: {state['outdoor_model']}")
    if state.get("indoor_model"):
        state_parts.append(f"modelo interno: {state['indoor_model']}")
    if state.get("display_type"):
        state_parts.append(f"display: {state['display_type']}")
    if state_parts:
        lines.append(f"ESTADO DA CONVERSA: {' | '.join(state_parts)}")
        lines.append("")
    elif state.get("error_codes"):
        codes = ", ".join(state["error_codes"])
        lines.append(f"Erros mencionados: {codes}")

    # Add memory context if available
    memory_context_str = pkg.get("memory_context_str", "")
    if memory_context_str:
        lines.append("")
        lines.append(memory_context_str)
        lines.append("")

    # Add evidence level
    level = pkg.get("evidence_level", "nenhum")
    level_labels = {
        "manual_exato": "Existe manual de serviço indexado para este modelo.",
        "manual_familia": "Existe manual da família, mas não o exato.",
        "triagem_tecnica": "Sem manual exato — use triagem técnica.",
        "sem_contexto": "Sem contexto na base — triagem geral.",
        "web_fallback": "Modelo não encontrado na base local — busca web realizada.",
    }
    lines.append(f"Evidência: {level_labels.get(level, level)}")

    # Add web search context if available
    web_ctx = pkg.get("web_context", [])
    if web_ctx:
        lines.append("")
        lines.append("CONTEXTO DA BUSCA WEB:")
        for i, r in enumerate(web_ctx[:4], 1):
            lines.append(f"[{i}] {r.get('title', '')[:80]}")
            lines.append(f"    {r.get('snippet', '')[:200]}")
        lines.append("")

    # Add manual context if available
    ctx_list = pkg.get("manual_context", [])
    if ctx_list:
        lines.append("")
        lines.append("CONTEXTO DO MANUAL:")
        for i, ctx in enumerate(ctx_list[:4], 1):
            if ctx.get("text"):
                lines.append(f"[{i}] {ctx['text'][:400]}")
                if ctx.get("safety_tags"):
                    lines.append(f"   ⚠️ {', '.join(ctx['safety_tags'][:2])}")
        lines.append("")

    # Add safety flags
    safety = pkg.get("safety_flags", [])
    if safety:
        lines.append(f"ALERTAS DE SEGURANÇA ativos: {', '.join(safety)}")

    # Add missing info
    if pkg.get("missing_info"):
        lines.append(f"INFORMAÇÕES FALTANDO: {', '.join(pkg['missing_info'])}")

    lines.extend([
        "",
        "REGRAS CRÍTICAS:",
        "- NUNCA mostre 'Graph interno', 'Evidência:' como rótulos — use 'Pela triagem técnica'",
        "- NUNCA invente valores de tensão, resistência, pressão, corrente ou carga de gás",
        "- NUNCA oriente medição energizada sem respaldo explícito do manual",
        "- Se não há manual exato: diga 'não tenho o manual exato aqui, então trato como triagem técnica'",
        "- Se faltam modelo/código: peça de forma amigável, uma coisa por vez",
        "- MAX 600 caracteres para respostas normais, 900 para procedimentos técnicos",
        "- MAX uma pergunta no final",
        "- Se evidência é web_fallback: cite a fonte da busca web de forma natural na resposta",
        "- RESPONDA SOMENTE EM PORTUGUÊS DO BRASIL — sem caracteres CJK, Cirílicos ou outros alfabetos não-latinos",
    ])

    return "\n".join(lines)


# Safety keywords used in retrieval package builder
SAFETY_KEYWORDS = {
    "ipm", "placa inverter", "inverter board", "ponte de diodos",
    "alta tensão", "alta pressão", "high voltage", "high pressure",
    "capacitor", "barramento link", "link dc", "dc bus",
    "compressor", "energizado", "lockout", "tagout",
}


def format_system_prompt(context: str) -> str:
    """Format system prompt for guided_triage mode (default router path)."""
    if context:
        return SYSTEM_PROMPT_TEMPLATE.format(context=context)
    return SYSTEM_PROMPT_TEMPLATE.format(context="[Nenhum trecho encontrado na base HVAC — use triagem técnica]")


def format_field_tutor_prompt(context: str) -> str:
    """Format system prompt for field_tutor mode."""
    if context:
        return FIELD_TUTOR_SYSTEM_PROMPT.format(context=context)
    return FIELD_TUTOR_SYSTEM_PROMPT.format(context="[Nenhum trecho encontrado na base HVAC — use triagem técnica]")


# =============================================================================
# OpenAI-Compatible API Endpoints
# =============================================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 1024
    stream: Optional[bool] = False


@app.get("/v1/models")
async def list_models():
    """
    OpenAI-compatible /v1/models endpoint.
    Exposes only zappro-clima-tutor publicly.
    Internal aliases (hvac-manual-strict, hvac-field-tutor, hvac-printable)
    are NOT exposed — they are handled internally by the router.
    """
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_NAME,
                "object": "model",
                "created": 1700000000,
                "owned_by": "hvac-rag-pipe",
                "permission": [],
                "root": MODEL_NAME,
                "parent": None,
            }
        ]
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, http_request: Request):
    """
    OpenAI-compatible /v1/chat/completions endpoint.

    Router logic:
      printable query  → /v1/chat/completions/printable (internal redirect)
      else             → guided_triage via MiniMax M2.7 + friendly rewriter

    MiniMax M2.7 is the primary reasoning/writing engine.
    Qdrant provides context; MiniMax formats the final answer.
    The friendly rewriter is a safety net for tone/polish.
    """
    # Extract user message and system content
    user_query = ""
    system_content = ""
    for msg in request.messages:
        if msg.role == "user":
            user_query = msg.content
        elif msg.role == "system":
            system_content = msg.content

    if not user_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request"}}
        )

    # Extract user_id and conversation_id from HTTP headers (OpenAI-compatible)
    user_id = "anonymous"
    conversation_id = "default"
    raw_headers = dict(http_request.headers)
    user_id = raw_headers.get("user_id", user_id)
    conversation_id = raw_headers.get("conversation_id", conversation_id)

    # Buscar memória relevante antes de responder (timeout 1s para não bloquear)
    fetch_result = {"user_preferences": [], "product_decisions": [], "domain_rules": [],
                    "conversation_state": {}, "recent_relevant_memories": [], "source_summary": {}}
    memory_context_str = ""
    try:
        fetch_result = await asyncio.wait_for(
            context_fetch(user_id=user_id, conversation_id=conversation_id,
                          query=user_query, domain="hvac"),
            timeout=1.0,
        )
        memory_context_str = build_context_pack(fetch_result)
    except asyncio.TimeoutError:
        _safe_log(f"context_fetch timeout for user={user_id} conv={conversation_id}")
    except Exception as e:
        _safe_log(f"context_fetch failed: {e}")

    # Extrair state do histórico de mensagens — corrige amnésia de conversa imediata
    # Priority: current_messages > mem0 > qdrant > graph
    current_messages_state = extract_state_from_messages(request.messages)
    merged_state = merge_state(current_messages_state, fetch_result)

    q_lower = user_query.lower().strip()

    # ── Route: printable ───────────────────────────────────────────────────────
    # Use word-boundary matching to avoid false positives (e.g. "Sprint" matching "print")
    printable_triggers = (
        r"\bimprimir\b", r"\bprint\b", r"\bresumo para\b", r"\bformato de impressão\b",
        r"\bpasso a passo\b", r"\blista de\b", r"\bchecklist\b", r"\bpara anota\b",
    )
    import re as _re
    if any(_re.search(t, q_lower) for t in printable_triggers):
        return await chat_completions_printable(request)

    # ── Juiz pre-flight check ────────────────────────────────────────────────
    juez_result, juez_meta = juiz(user_query)
    _safe_log(f"Router: {juez_result.value} reason={juez_meta.get('reason')} {_log_query_meta(user_query)}")

    # ── BLOCKED ─────────────────────────────────────────────────────────────
    if juez_result == JuizResult.BLOCKED:
        friendly_blocked = rewrite_blocked()
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_blocked}, "finish_reason": "stop"}],
        }

    # ── ASK_CLARIFICATION — mas verifica se state já tem info suficiente ────────
    # Se state tem brand + family + subcode, NÃO pedir display de novo
    # Se state tem brand + family + subcode + outdoor_model, NÃO pedir modelo de novo
    if juez_result == JuizResult.ASK_CLARIFICATION:
        if state_sufficient_for_diagnosis(merged_state):
            # State suficiente — força APPROVED em vez de pedir info de novo
            _safe_log(f"Router: overriding ASK_CLARIFICATION — state sufficient: brand={merged_state.get('brand')} family={merged_state.get('family')} subcode={merged_state.get('subcode')}")
            juez_result = JuizResult.APPROVED
            juez_meta["override_reason"] = "conversation_state_sufficient"
            juez_meta["merged_state"] = {
                "brand": merged_state.get("brand", ""),
                "family": merged_state.get("family", ""),
                "alarm_code": merged_state.get("alarm_code", ""),
                "subcode": merged_state.get("subcode", ""),
                "outdoor_model": merged_state.get("outdoor_model", ""),
                "indoor_model": merged_state.get("indoor_model", ""),
                "display_type": merged_state.get("display_type", ""),
                "all_codes": merged_state.get("all_codes", []),
                "all_models": merged_state.get("all_models", []),
            }
        elif state_sufficient_for_triage(merged_state):
            # State completo para triagem — próxima pergunta deve ser diagnóstica
            _safe_log(f"Router: overriding ASK_CLARIFICATION — state sufficient for triage: model={merged_state.get('outdoor_model')}")
            juez_result = JuizResult.APPROVED
            juez_meta["override_reason"] = "conversation_state_triage_ready"
            juez_meta["merged_state"] = {
                "brand": merged_state.get("brand", ""),
                "family": merged_state.get("family", ""),
                "alarm_code": merged_state.get("alarm_code", ""),
                "subcode": merged_state.get("subcode", ""),
                "outdoor_model": merged_state.get("outdoor_model", ""),
                "indoor_model": merged_state.get("indoor_model", ""),
                "display_type": merged_state.get("display_type", ""),
                "all_codes": merged_state.get("all_codes", []),
                "all_models": merged_state.get("all_models", []),
            }
        else:
            # State insuficiente — manter ASK normal mas com partial_info do state
            has_safety = bool(juez_meta.get("safety_only_without_model"))
            partial_info = ""
            if merged_state.get("brand"):
                partial_info = f"sei que é {merged_state['brand']}"
            if merged_state.get("subcode"):
                partial_info = f"{partial_info}, código {merged_state['subcode']}" if partial_info else f"sei que você tem {merged_state['subcode']}"
            elif merged_state.get("alarm_code"):
                partial_info = f"{partial_info}, código {merged_state['alarm_code']}" if partial_info else f"sei que você tem {merged_state['alarm_code']}"
            friendly_ask = rewrite_ask(has_safety=has_safety, partial_info=partial_info)
            return {
                "id": "hvac-chat-completion",
                "object": "chat.completion",
                "created": 0,
                "model": MODEL_NAME,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_ask}, "finish_reason": "stop"}],
            }

    # ── APPROVED — build retrieval package + call MiniMax ─────────────────────
    hits = await search_qdrant(user_query, top_k=DEFAULT_TOP_K)
    context = build_rag_context(hits)
    pkg = build_retrieval_package(user_query, hits, juez_meta,
                                  memory_context=fetch_result,
                                  memory_context_str=memory_context_str,
                                  merged_state=merged_state)

    # ── Web search fallback: Qdrant miss or no evidence ───────────────────────
    # If Qdrant returned 0 hits OR evidence is "sem_contexto", try web search
    needs_web_search = (len(hits) == 0 or pkg.get("evidence_level") in ("sem_contexto", "nenhum"))
    if needs_web_search:
        web_results = await search_web_ddg(f"{user_query} ar condicionado inverter diagnóstico técnica")
        if web_results:
            pkg["web_context"] = web_results
            pkg["evidence_level"] = "web_fallback"
            _safe_log(f"[web-search] Added {len(web_results)} web results for query: {user_query[:60]}")


    # Build MiniMax system prompt (primary reasoning engine)
    minimax_system = build_minimax_system_prompt(pkg)

    # Prepend HVAC system prompt, preserving any existing system content
    if system_content:
        final_system = f"{minimax_system}\n\n[System original do usuário]\n{system_content}"
    else:
        final_system = minimax_system

    messages_for_llm = [{"role": "system", "content": final_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": msg.content})

    _safe_log(f"Tutor: hits={len(hits)} ctx={len(context)} mode=guided_tutor {_log_query_meta(user_query)}")

    # ── Call MiniMax M2.7 as primary LLM ─────────────────────────────────────
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        try:
            litellm_payload = {
                "model": PRIMARY_LLM_MODEL,
                "messages": messages_for_llm,
                "temperature": max(request.temperature, 0.45),  # min 0.45 for friendly tone
                "max_tokens": min(request.max_tokens or 1024, 1400),
                "stream": False,
            }
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers=litellm_headers(),
                json=litellm_payload,
            )
            if r.status_code == 200:
                result = r.json()
                message = result.get("choices", [{}])[0].get("message", {})
                # MiniMax M2.7 puts extended thinking in reasoning_content
                raw_content = message.get("content") or message.get("reasoning_content") or ""
                # Apply friendly rewriter as safety net
                friendly_content = rewrite_response(raw_content, user_query=user_query)
                result["choices"][0]["message"]["content"] = friendly_content
                result["model"] = MODEL_NAME

                # Salvar interação na memória após resposta
                try:
                    memory_writeback(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        query=user_query,
                        answer=friendly_content,
                        metadata={
                            "domain": "hvac",
                            "model": "zappro-clima-tutor",
                            "mode": "guided_triage",
                            "evidence": pkg.get("evidence_level", "unknown"),
                            "conversation_state": pkg.get("conversation_state", {}),
                        },
                    )
                except Exception as e:
                    _safe_log(f"memory_writeback failed: {e}")

                return result
            else:
                err_type = r.json().get("error", {}).get("type", "upstream_error") if r.text else "upstream_error"
                _safe_log(f"LiteLLM error: status={r.status_code} type={err_type}")
                if context:
                    req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                    return _build_safe_fallback_response(context, user_query, req_id)
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": "Upstream LLM error", "type": err_type}}
                )
        except httpx.TimeoutException:
            if context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                return _build_safe_fallback_response(context, user_query, req_id)
            return JSONResponse(
                status_code=504,
                content={"error": {"message": "LLM timeout", "type": "upstream_timeout"}}
            )
        except Exception as e:
            err_name = type(e).__name__
            _safe_log(f"LiteLLM error: {err_name}")
            if context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                return _build_safe_fallback_response(context, user_query, req_id)
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"Upstream error: {err_name}", "type": "upstream_error"}}
            )


# =============================================================================
# Field Tutor Endpoint — Enhanced context for field technicians
# =============================================================================

@app.post("/v1/chat/completions/field-tutor")
async def chat_completions_field_tutor(request: ChatCompletionRequest):
    """
    Enhanced /v1/chat/completions/field-tutor endpoint.

    Uses Field Tutor for expanded context:
    - top_k=10 (vs 6 in standard)
    - Safety lockout/tagout procedures
    - Diagnostic flowcharts for error codes
    - Installation checklists
    """
    # Extract user message
    user_query = ""
    for msg in request.messages:
        if msg.role == "user":
            user_query = msg.content
            break

    if not user_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request"}}
        )

    # Juiz pre-flight check
    juez_result, juez_meta = juiz(user_query)
    _safe_log(f"[field-tutor] Juiz: {juez_result.value} reason={juez_meta.get('reason')}")

    if juez_result == JuizResult.BLOCKED:
        friendly_blocked = rewrite_blocked()
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_blocked}, "finish_reason": "stop"}],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
        has_safety = bool(juez_meta.get("safety_only_without_model"))
        friendly_ask = rewrite_ask(has_safety=has_safety)
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_ask}, "finish_reason": "stop"}],
        }

    # Get Field Tutor enhanced context
    try:
        field_context = await _ft_mod.field_tutor_query(user_query)
    except Exception as e:
        _safe_log(f"[field-tutor] Error: {type(e).__name__}")
        field_context = "[Erro ao buscar contexto expandido]"

    # Build field tutor prompt with friendly tone
    ft_system = format_field_tutor_prompt(field_context)

    messages_for_llm = [{"role": "system", "content": ft_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": msg.content})

    _safe_log(f"[field-tutor] context_chars={len(field_context)} {_log_query_meta(user_query)}")

    # Forward to LiteLLM
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        try:
            litellm_payload = {
                "model": PRIMARY_LLM_MODEL,
                "messages": messages_for_llm,
                "temperature": max(request.temperature, 0.45),
                "max_tokens": min(request.max_tokens or 1024, 1600),
                "stream": False,
            }
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers=litellm_headers(),
                json=litellm_payload,
            )
            if r.status_code == 200:
                result = r.json()
                message = result.get("choices", [{}])[0].get("message", {})
                raw_content = message.get("content") or message.get("reasoning_content") or ""
                friendly_content = rewrite_response(raw_content, user_query=user_query)
                result["choices"][0]["message"]["content"] = friendly_content
                result["model"] = MODEL_NAME
                return result
            else:
                err_type = r.json().get("error", {}).get("type", "upstream_error") if r.text else "upstream_error"
                _safe_log(f"[field-tutor] LiteLLM error: status={r.status_code} type={err_type}")
                if field_context and "[Erro ao buscar" not in field_context:
                    req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                    return _build_safe_fallback_response(field_context, user_query, req_id)
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": "Upstream LLM error", "type": err_type}}
                )
        except httpx.TimeoutException:
            if field_context and "[Erro ao buscar" not in field_context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                return _build_safe_fallback_response(field_context, user_query, req_id)
            return JSONResponse(
                status_code=504,
                content={"error": {"message": "LLM timeout", "type": "upstream_timeout"}}
            )
        except Exception as e:
            err_name = type(e).__name__
            _safe_log(f"[field-tutor] LiteLLM error: {err_name}")
            if field_context and "[Erro ao buscar" not in field_context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                return _build_safe_fallback_response(field_context, user_query, req_id)
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"Upstream error: {err_name}", "type": "upstream_error"}}
            )


# =============================================================================
# Printable Endpoint — Plain text for thermal printers
# =============================================================================

@app.post("/v1/chat/completions/printable")
async def chat_completions_printable(request: ChatCompletionRequest):
    """
    /v1/chat/completions/printable endpoint.

    Returns formatted plain text suitable for 58mm thermal printers:
    - Stripped markdown
    - 48-char line width
    - ASCII safety boxes
    - Numbered procedures
    """
    # Extract user message
    user_query = ""
    for msg in request.messages:
        if msg.role == "user":
            user_query = msg.content
            break

    if not user_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request"}}
        )

    # Juiz pre-flight check
    juez_result, juez_meta = juiz(user_query)
    _safe_log(f"[printable] Juiz: {juez_result.value} reason={juez_meta.get('reason')}")

    if juez_result == JuizResult.BLOCKED:
        friendly_blocked = rewrite_blocked()
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_blocked}, "finish_reason": "stop"}],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
        has_safety = bool(juez_meta.get("safety_only_without_model"))
        friendly_ask = rewrite_ask(has_safety=has_safety)
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": friendly_ask}, "finish_reason": "stop"}],
        }

    # Get Field Tutor enhanced context
    try:
        field_context = await _ft_mod.field_tutor_query(user_query)
    except Exception as e:
        _safe_log(f"[printable] Field Tutor error: {type(e).__name__}")
        field_context = "[Erro ao buscar contexto]"

    # Format for thermal printer
    try:
        printable_text = _fmt_mod.format_for_print(field_context)
    except Exception as e:
        _safe_log(f"[printable] Formatter error: {type(e).__name__}")
        printable_text = field_context  # Fallback to raw context

    _safe_log(f"[printable] output_chars={len(printable_text)} {_log_query_meta(user_query)}")

    # Return plain text response (not JSON LLM response)
    return {
        "id": "hvac-chat-completion",
        "object": "chat.completion",
        "created": 0,
        "model": MODEL_NAME,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": printable_text,
                },
                "finish_reason": "stop",
            }
        ],
    }


# =============================================================================
# OpenWebUI Pipeline Filter Endpoints (backwards compatibility)
# =============================================================================

@app.post("/hvac-rag/filter/inlet")
async def filter_inlet(request: Request):
    """OpenWebUI pipeline inlet filter — injects RAG context."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    messages = body.get("messages", [])
    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "")
            break

    if not user_query:
        return body

    if is_out_of_domain(user_query):
        _safe_log(f"[filter] Out-of-domain blocked {_log_query_meta(user_query)}")
        # Return empty context so model knows to refuse
        enriched = format_system_prompt("")
    else:
        hits = await search_qdrant(user_query, top_k=DEFAULT_TOP_K)
        context = build_rag_context(hits)
        enriched = format_system_prompt(context)

    # Update or prepend system message
    messages_updated = False
    for i, msg in enumerate(messages):
        if msg.get("role") == "system":
            messages[i]["content"] = enriched
            messages_updated = True
            break

    if not messages_updated:
        messages.insert(0, {"role": "system", "content": enriched})

    body["messages"] = messages
    _safe_log(f"[filter] hits={len(hits) if not is_out_of_domain(user_query) else 0} {_log_query_meta(user_query)}")
    return body


@app.post("/hvac-rag/filter/outlet")
async def filter_outlet(request: Request):
    """OpenWebUI pipeline outlet filter — pass through."""
    try:
        return await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")


# =============================================================================
# Health & Info
# =============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "hvac-rag-pipe",
        "version": "2.0.0",
        "public_model": MODEL_NAME,
        "internal_models": INTERNAL_MODELS,
    }


@app.get("/memory/health")
async def memory_health():
    result = await memory_health_summary()
    return JSONResponse(content=result)


@app.get("/")
async def root():
    return {
        "service": "HVAC RAG Pipe — Zappro Clima Tutor",
        "version": "2.0.0",
        "strategy": "minimax_primary_rag_context_tutor",
        "public_model": MODEL_NAME,
        "internal_models": INTERNAL_MODELS,
        "endpoints": [
            "/v1/models",
            "/v1/chat/completions",
            "/v1/chat/completions/field-tutor",
            "/v1/chat/completions/printable",
            "/health",
            "/hvac-rag/filter/inlet",
        ],
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    _safe_log(f"Starting HVAC RAG Pipe on {PIPELINE_HOST}:{PIPELINE_PORT}")
    _safe_log(f"Qdrant: {QDRANT_URL} | Ollama: {OLLAMA_URL} | LiteLLM: {LITELLM_URL}")
    uvicorn.run(app, host=PIPELINE_HOST, port=PIPELINE_PORT, log_level="warning")
