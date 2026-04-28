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
_juez_mod = import_local_module("hvac_juiz", "hvac-juiz.py")
JuizResult = _juez_mod.JuizResult
juiz = _juez_mod.judge

# Import Field Tutor module
_ft_mod = import_local_module("hvac_field_tutor", "hvac-field-tutor.py")

# Import Formatter module
_fmt_mod = import_local_module("hvac_formatter", "hvac-formatter.py")

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
MODEL_NAME = "hvac-manual-strict"
PIPELINE_PORT = int(os.environ.get("PIPELINE_PORT", "4017"))
PIPELINE_HOST = os.environ.get("PIPELINE_HOST", "0.0.0.0")

# Limits
DEFAULT_TOP_K = 6
MAX_CONTEXT_CHARS = 7000
EMBED_TIMEOUT = 60
SEARCH_TIMEOUT = 20
CHAT_TIMEOUT = 120

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
# System Prompt Template
# =============================================================================

SYSTEM_PROMPT_TEMPLATE = """Você é um assistente técnico de manutenção de ar-condicionado inverter.

MODO: manual_strict (apenas manuais indexados).

REGRAS OBRIGATÓRIAS:
1. Responda EM PORTUGUÊS DO BRASIL.
2. Use SOMENTE os trechos recuperados da base HVAC abaixo como fonte primária.
3. Cite sempre que puder: manual, seção, modelo ou chunk no formato [Trecho N].
4. Se a base não tiver a informação, diga: "não encontrei isso nos manuais indexados para este modelo".
5. NUNCA invente valores de: tensão, resistência, pressão, frequência, corrente ou carga de fluido refrigerante.
6. Para placa inverter, IPM, ponte de diodos, compressor, alta tensão, capacitor ou link/DC bus:
   - AVISO DE SEGURANÇA: o procedimento envolve risco elétrico
   - RECOMENDE técnico qualificado
   - INDIQUE seguir o manual do modelo específico
   - NÃO descreva medição energizada sem respaldo explícito do manual
7. Se faltarem informações do modelo (unidade interna E externa), peça o modelo completo ANTES de responder.
8. Separe sua resposta em: Confirmação → Procedimento → Limitações.

CONTEXTO HVAC RECUPERADO:
{context}

---
Responda com base exclusivamente no contexto acima. Se não há contexto relevante, diga que não encontrou."""


def format_system_prompt(context: str) -> str:
    if context:
        return SYSTEM_PROMPT_TEMPLATE.format(context=context)
    return SYSTEM_PROMPT_TEMPLATE.format(context="[Nenhum trecho encontrado na base HVAC]")


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
    """OpenAI-compatible /v1/models endpoint."""
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
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI-compatible /v1/chat/completions endpoint.
    1. Extract user query
    2. Check domain
    3. Search Qdrant
    4. Inject context
    5. Forward to LiteLLM
    """
    # Extract user message
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

    # Juiz pre-flight check
    juez_result, juez_meta = juiz(user_query)
    _safe_log(f"Juiz: {juez_result.value} reason={juez_meta.get('reason')} query={user_query[:40]}…")

    if juez_result == JuizResult.BLOCKED:
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
                        "content": (
                            "Esta base de conhecimento é especializada em ar-condicionado, "
                            "climatização e refrigeração VRV/VRF. "
                            "Não encontrei informações relevantes para sua pergunta. "
                            "Tente perguntar sobre um modelo de ar-condicionado, código de erro, "
                            "ou procedimento de manutenção HVAC."
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
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
                        "content": (
                            "Para ajudar melhor, preciso do modelo completo da unidade. "
                            "Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna). "
                            "Com o modelo completo posso buscar o procedimento específico no manual."
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    # Juiz APPROVED - proceed with Qdrant search
    # Search Qdrant
    hits = await search_qdrant(user_query, top_k=DEFAULT_TOP_K)
    context = build_rag_context(hits)

    # Build messages for LiteLLM
    enriched_system = format_system_prompt(context)
    # Prepend HVAC system prompt, preserving any existing system content
    if system_content:
        final_system = f"{enriched_system}\n\n[System original do usuário]\n{system_content}"
    else:
        final_system = enriched_system

    messages_for_llm = [{"role": "system", "content": final_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": msg.content})

    _safe_log(
        f"query={user_query[:40]}… hits={len(hits)} "
        f"context_chars={len(context)} model={request.model}"
    )

    # Forward to LiteLLM
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        try:
            litellm_payload = {
                "model": "minimax-m2.7",
                "messages": messages_for_llm,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "stream": False,
            }
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers=litellm_headers(),
                json=litellm_payload,
            )
            if r.status_code == 200:
                result = r.json()
                result["model"] = MODEL_NAME
                return result
            else:
                _safe_log(f"LiteLLM error: {r.status_code} {r.text[:100]}")
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": "Upstream LLM error", "type": "upstream_error"}}
                )
        except httpx.TimeoutException:
            return JSONResponse(
                status_code=504,
                content={"error": {"message": "LLM timeout", "type": "upstream_timeout"}}
            )
        except Exception as e:
            _safe_log(f"LiteLLM error: {type(e).__name__}")
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"Upstream error: {type(e).__name__}", "type": "upstream_error"}}
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
                        "content": (
                            "Esta base de conhecimento é especializada em ar-condicionado, "
                            "climatização e refrigeração VRV/VRF."
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
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
                        "content": (
                            "Para ajudar melhor, preciso do modelo completo da unidade. "
                            "Exemplo: RXYQ20BRA + FXYC20BRA."
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    # Get Field Tutor enhanced context
    try:
        field_context = await _ft_mod.field_tutor_query(user_query)
    except Exception as e:
        _safe_log(f"[field-tutor] Error: {type(e).__name__}")
        field_context = "[Erro ao buscar contexto expandido]"

    # Build simplified prompt for LLM (already has context from Field Tutor)
    ft_system = f"""Você é um assistente técnico de manutenção de ar-condicionado inverter.

MODO: field_tutor (contexto expandido com procedimentos de segurança).

REGRAS OBRIGATÓRIAS:
1. Responda EM PORTUGUÊS DO BRASIL.
2. Use SOMENTE os trechos retrieved da base HVAC abaixo.
3. Cite sempre: [Trecho N]
4. NUNCA invente valores de tensão, resistência, pressão ou carga de gás.
5. Para IPM, alta tensão, ponte de diodos: inclua AVISO DE SEGURANÇA e recomende técnico qualificado.

CONTEXTO HVAC EXPANDIDO:
{field_context}

---
Responda com base no contexto acima."""

    messages_for_llm = [{"role": "system", "content": ft_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": msg.content})

    _safe_log(f"[field-tutor] query={user_query[:40]}… context_chars={len(field_context)}")

    # Forward to LiteLLM
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        try:
            litellm_payload = {
                "model": "minimax-m2.7",
                "messages": messages_for_llm,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "stream": False,
            }
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers=litellm_headers(),
                json=litellm_payload,
            )
            if r.status_code == 200:
                result = r.json()
                result["model"] = MODEL_NAME
                return result
            else:
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": "Upstream LLM error", "type": "upstream_error"}}
                )
        except httpx.TimeoutException:
            return JSONResponse(
                status_code=504,
                content={"error": {"message": "LLM timeout", "type": "upstream_timeout"}}
            )
        except Exception as e:
            _safe_log(f"[field-tutor] LiteLLM error: {type(e).__name__}")
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"Upstream error: {type(e).__name__}", "type": "upstream_error"}}
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
                        "content": (
                            "Esta base é especializada em ar-condicionado HVAC. "
                            "Pergunte sobre modelos, códigos de erro ou procedimentos de manutenção."
                        ),
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
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
                        "content": "Forneça o modelo completo para busca no manual. Ex: RXYQ20BRA + FXYC20BRA",
                    },
                    "finish_reason": "stop",
                }
            ],
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

    _safe_log(f"[printable] query={user_query[:40]}… output_chars={len(printable_text)}")

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
        _safe_log(f"[filter] Out-of-domain blocked: {user_query[:40]}…")
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
    _safe_log(f"[filter] query={user_query[:40]}… hits={len(hits) if not is_out_of_domain(user_query) else 0}")
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
    return {"status": "ok", "service": "hvac-rag-pipe", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "service": "HVAC RAG Pipe",
        "version": "1.0.0",
        "strategy": "openai_compatible_rag_pipe",
        "model": MODEL_NAME,
        "endpoints": ["/v1/models", "/v1/chat/completions", "/health", "/hvac-rag/filter/inlet"],
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    _safe_log(f"Starting HVAC RAG Pipe on {PIPELINE_HOST}:{PIPELINE_PORT}")
    _safe_log(f"Qdrant: {QDRANT_URL} | Ollama: {OLLAMA_URL} | LiteLLM: {LITELLM_URL}")
    uvicorn.run(app, host=PIPELINE_HOST, port=PIPELINE_PORT, log_level="warning")
