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
_juez_mod = import_local_module("hvac_juiz", "hvac-juiz.py")
JuizResult = _juez_mod.JuizResult
juiz = _juez_mod.judge

# Import Field Tutor module
_ft_mod = import_local_module("hvac_field_tutor", "hvac-field-tutor.py")

# Import Formatter module
_fmt_mod = import_local_module("hvac_formatter", "hvac-formatter.py")

# Import Copilot Router module
_copilot_mod = import_local_module("hvac_copilot_router", "hvac-copilot-router.py")
CopilotRouter = _copilot_mod.CopilotRouter

# Import Conversation State module
_conv_mod = import_local_module("hvac_conversation_state", "hvac-conversation-state.py")
StateManager = _conv_mod.StateManager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Header
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
PIPELINE_HOST = os.environ.get("PIPELINE_HOST", "127.0.0.1")

# Copilot Model ID
COPILOT_MODEL_ID = "hvac-copilot"

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
# Module-level instances
# =============================================================================

# StateManager for conversation state (copilot flow)
state_manager = StateManager()

# CopilotRouter instance
copilot_router = CopilotRouter()

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


def _build_safe_fallback_response(context: str, user_query: str, request_id: str = "", guided_triage: bool = False) -> dict:
    """
    Build a safe fallback response when LiteLLM is unavailable.
    Returns structured response with context, not a raw 502.
    """
    if guided_triage:
        # Guided triage fallback - give helpful triage info even without LLM
        fallback_text = (
            "Entendi que você está com problema de código de erro no sistema VRV/VRF.\n\n"
            "Como o modelo de linguagem não está disponível no momento, aqui está o que sei:\n\n"
            "=== INFORMAÇÕES DE TRIAGEM ===\n\n"
            f"{context[:4000]}\n\n"
            "=========================================\n\n"
            "Nota: Confirme sempre com o manual específico do modelo.\n"
            "Tente novamente em alguns momentos para uma análise mais completa.\n"
            f"ID: {request_id or 'n/a'}"
        )
    elif context:
        # Has context — return structured response with recovered context (existing logic)
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
        "guided_triage": guided_triage,
    }


def build_probable_triage_context(query: str, error_code: str, family: str) -> str:
    """Build 'probable triage' context when exact model not found but family+error match."""
    return f"""[TRIAGEM PROVÁVEL - CONFIRMAR COM MANUAL]

Você mencionou: código {error_code}, família {family}.

Esta é uma *pista inicial* baseada no código de erro e família do equipamento.

**Para confirmar o diagnóstico:**
1. Verifique o subcódigo completo no display da unidade (ex: E4-01)
2. Confirme se é unidade Master ou Slave
3. Consulte o manual específico do modelo

**Aviso:** Não faça medições invasivas sem respaldo do manual.
"""


def has_partial_match(hits: list, query: str) -> tuple[bool, str, str]:
    """
    Check if hits represent a partial match (family+error but no specific model).

    Returns (is_partial, error_code, family):
    - is_partial: True if we have error_code or family match but no specific model match
    - error_code: extracted error code from query (e.g., "E4")
    - family: extracted model family from query (e.g., "RXYQ")
    """
    errors_in_query = HVAC_ERROR_CODES.findall(query)
    models_in_query = HVAC_MODEL_PATTERNS.findall(query)

    if not errors_in_query and not models_in_query:
        return False, "", ""

    error_code = errors_in_query[0].upper() if errors_in_query else ""
    family = models_in_query[0].upper() if models_in_query else ""

    # Check if any hit has specific model match
    has_model_match = False
    has_error_match = False
    has_family_match = False

    for hit in hits:
        payload = hit.get("payload", {})
        hit_models = [m.upper() for m in payload.get("model_candidates", [])]
        hit_errors = [e.upper() for e in payload.get("error_code_candidates", [])]

        if hit_models:
            has_model_match = True
        if error_code and error_code in hit_errors:
            has_error_match = True
        # Check family match (prefix of model)
        if family:
            for hm in hit_models:
                if hm.startswith(family) or family.startswith(hm):
                    has_family_match = True
                    break

    # Partial = has error/family match but no specific model match
    if (has_error_match or has_family_match) and not has_model_match:
        return True, error_code, family

    return False, "", ""


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


def extract_conversation_id(
    request: Request,
    user_query: str
) -> str:
    """
    Extract conversation_id from request headers or generate from user query hash.
    Looks for x-conversation-id header, falls back to hash-based generation.
    """
    # Try to get from header
    conversation_id = request.headers.get("x-conversation-id", "").strip()
    if conversation_id:
        return conversation_id

    # Generate from query hash as fallback
    q_hash = hashlib.sha256(user_query.encode()).hexdigest()[:16]
    return f"conv-{q_hash}"


def expand_query_with_state(conversation_id: str, query: str) -> str:
    """
    Expand short queries using conversation state.
    Before Juiz check: if query is short (< 15 chars) and we have state, expand it.
    """
    if len(query.strip()) >= 15:
        return query

    # Get conversation state
    state = state_manager.get_state(conversation_id)
    if not state:
        return query

    # Build expanded context from state
    expanded_parts = [query]

    if state.get("extracted_model"):
        expanded_parts.append(f"modelo: {state['extracted_model']}")
    if state.get("extracted_error_code"):
        expanded_parts.append(f"erro: {state['extracted_error_code']}")
    if state.get("extracted_family"):
        expanded_parts.append(f"família: {state['extracted_family']}")

    if len(expanded_parts) > 1:
        return " | ".join(expanded_parts)
    return query


def update_conversation_state(conversation_id: str, user_query: str, hits: list, juez_meta: dict) -> None:
    """
    Update conversation state after Juiz check with extracted data.
    """
    extracted_model = ""
    extracted_error_code = ""
    extracted_family = ""

    # Extract from query
    errors_in_query = HVAC_ERROR_CODES.findall(user_query)
    models_in_query = HVAC_MODEL_PATTERNS.findall(user_query)

    if errors_in_query:
        extracted_error_code = errors_in_query[0].upper()
    if models_in_query:
        extracted_model = models_in_query[0].upper()

    # Extract family from model or hits
    if extracted_model and "-" in extracted_model:
        extracted_family = extracted_model.split("-")[0]
    elif extracted_model:
        # Take first 4 chars as family hint
        extracted_family = extracted_model[:4]

    # Check hits for additional context
    if hits and not extracted_model:
        for hit in hits[:3]:
            payload = hit.get("payload", {})
            hit_models = payload.get("model_candidates", [])
            if hit_models and not extracted_model:
                # Find first model that matches our patterns
                for hm in hit_models:
                    if HVAC_MODEL_PATTERNS.search(hm):
                        extracted_model = hm.upper()
                        if "-" in hm:
                            extracted_family = hm.split("-")[0].upper()
                        break

    # Update state
    updates = {}
    if extracted_error_code:
        updates["extracted_error_code"] = extracted_error_code
    if extracted_model:
        updates["extracted_model"] = extracted_model
    if extracted_family:
        updates["extracted_family"] = extracted_family

    if updates:
        state_manager.update_state(conversation_id, updates)


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

REGRAS DE UX PARA USUÁRIOS LEIGOS:
9. Se o usuário for leigo (técnico ou cliente sem experiência em HVAC), AJUDE A IDENTIFICAR o próximo dado simples antes de pedir tudo.
10. Para erro principal sem subcódigo (ex: E4, E3, U4):
    - Explique a *família provável* do erro (ex: E4 = baixa pressão em VRV Daikin)
    - Peça APENAS o subcódigo (ex: E4-01)
    - NÃO peça modelo completo primeiro quando já tem pista suficiente
11. Faça UMA PERGUNTA POR VEZ. Não peça todos os dados de uma vez:
    - Errado: "Forneça modelo externo, interno, subcódigo, serial, foto"
    - Certo: "Primeiro, qual é o subcódigo que aparece no display? (ex: E4-01)"
12. Diferencie VRV/VRF de High-Wall/Split:
    - Se o usuário mencionar "split" ou "hi-wall", AVISE que a tabela de códigos pode ser diferente do VRV
    - Nunca use tabela VRV sem confirmar a família do equipamento

CONTEXTO HVAC RECUPERADO:
{context}

---
Responda com base exclusivamente no contexto acima. Se não há contexto relevante, diga que não encontrou."""


def format_system_prompt(context: str) -> str:
    if context:
        return SYSTEM_PROMPT_TEMPLATE.format(context=context)
    return SYSTEM_PROMPT_TEMPLATE.format(context="[Nenhum trecho encontrado na base HVAC]")


FIELD_TUTOR_SYSTEM_PROMPT = """Você é um assistente técnico de manutenção de ar-condicionado inverter.

MODO: field_tutor (contexto expandido com procedimentos de segurança).

REGRAS OBRIGATÓRIAS:
1. Responda EM PORTUGUÊS DO BRASIL.
2. Use SOMENTE os trechos retrieved da base HVAC abaixo.
3. Cite sempre: [Trecho N]
4. NUNCA invente valores de tensão, resistência, pressão ou carga de gás.
5. Para IPM, alta tensão, ponte de diodos: inclua AVISO DE SEGURANÇA e recomende técnico qualificado.

REGRAS DE UX:
6. Se o usuário for leigo, ajude a identificar o próximo dado simples.
7. Para erro principal sem subcódigo, explique a família provável e peça subcódigo.
8. Faça uma pergunta por vez.
9. Diferencie VRV/VRF de High-Wall/Split - avise se necessário.

CONTEXTO HVAC EXPANDIDO:
{context}

---
Responda com base no contexto acima."""


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
    """OpenAI-compatible /v1/models endpoint. Returns 4 available models."""
    return {
        "object": "list",
        "data": [
            {
                "id": "hvac-copilot",
                "object": "model",
                "created": 1700000000,
                "owned_by": "hvac-rag-pipe",
                "permission": [],
                "root": "hvac-copilot",
                "parent": None,
                "default": True,
                "preferred": True,
            },
            {
                "id": "hvac-manual-strict",
                "object": "model",
                "created": 1700000000,
                "owned_by": "hvac-rag-pipe",
                "permission": [],
                "root": "hvac-manual-strict",
                "parent": None,
            },
            {
                "id": "hvac-field-tutor",
                "object": "model",
                "created": 1700000000,
                "owned_by": "hvac-rag-pipe",
                "permission": [],
                "root": "hvac-field-tutor",
                "parent": None,
            },
            {
                "id": "hvac-printable",
                "object": "model",
                "created": 1700000000,
                "owned_by": "hvac-rag-pipe",
                "permission": [],
                "root": "hvac-printable",
                "parent": None,
            },
        ]
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI-compatible /v1/chat/completions endpoint.
    Routes to copilot flow if model is hvac-copilot, otherwise uses existing strict flow.
    """
    # Route to copilot flow if hvac-copilot model
    if request.model == "hvac-copilot":
        return await chat_completions_copilot(request)

    # Route to field-tutor if hvac-field-tutor model
    if request.model == "hvac-field-tutor":
        return await chat_completions_field_tutor(request)

    # Route to printable if hvac-printable model
    if request.model == "hvac-printable":
        return await chat_completions_printable(request)

    # Default: existing hvac-manual-strict flow
    return await _chat_completions_strict(request)


async def _chat_completions_strict(request: ChatCompletionRequest):
    """
    Internal strict mode implementation.
    1. Extract user query
    2. Check domain via Juiz
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
    _safe_log(f"Juiz: {juez_result.value} reason={juez_meta.get('reason')} {_log_query_meta(user_query)}")

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
        # Check if this is a safety query without model
        if juez_meta.get("safety_only_without_model"):
            safety_msg = (
                "⚠️ Para procedimentos de segurança em alta tensão (IPM, placa inverter, "
                "ponte de diodos, capacitor, compressor), é obrigatório:\n\n"
                "1. DESLIGAR a unidade da rede elétrica\n"
                "2. AGUARDAR o tempo especificado no manual/fabricante/etiqueta\n"
                "3. CONFIRMAR ausência de tensão com multímetro antes de tocar componentes\n"
                "4. Usar EPIs adequados (luvas classe III, óculos, calçado isolante)\n"
                "5. NUNCA medir energizado sem respaldo explícito do manual\n\n"
                "─────────────────────────\n\n"
                "Para diagnóstico específico, forneça o MODELO COMPLETO da unidade. "
                "Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna)."
            )
        else:
            safety_msg = (
                "Para ajudar melhor, preciso do modelo completo da unidade. "
                "Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna). "
                "Com o modelo completo posso buscar o procedimento específico no manual."
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
                        "content": safety_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.GUIDED_TRIAGE:
        guided_msg = (
            "Você está com problema de código de erro no sistema VRV/VRF.\n\n"
            "Vou ajudar a identificar. Primeiro, qual é o subcódigo que aparece? "
            "(ex: E4-01, E4-001, E3-02)\n\n"
            "Dica: O subcódigo aparece após o código principal no display da unidade."
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
                        "content": guided_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
            "guided_triage": True,
        }

    # Juiz APPROVED - proceed with Qdrant search
    # Search Qdrant
    hits = await search_qdrant(user_query, top_k=DEFAULT_TOP_K)
    context = build_rag_context(hits)

    # Check for partial match (family+error but no specific model)
    is_partial_triage, error_code, family = has_partial_match(hits, user_query)
    if is_partial_triage:
        partial_context = build_probable_triage_context(user_query, error_code, family)
    else:
        partial_context = ""

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

    _safe_log(f"Qdrant: hits={len(hits)} context_chars={len(context)} model={request.model} {_log_query_meta(user_query)}")

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
                err_type = r.json().get("error", {}).get("type", "upstream_error") if r.text else "upstream_error"
                _safe_log(f"LiteLLM error: status={r.status_code} type={err_type}")
                # If we have context, return fallback response instead of 502
                if context or partial_context:
                    req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                    fallback_ctx = partial_context if is_partial_triage else context
                    return _build_safe_fallback_response(fallback_ctx, user_query, req_id, guided_triage=is_partial_triage)
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": "Upstream LLM error", "type": err_type}}
                )
        except httpx.TimeoutException:
            if context or partial_context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                fallback_ctx = partial_context if is_partial_triage else context
                return _build_safe_fallback_response(fallback_ctx, user_query, req_id, guided_triage=is_partial_triage)
            return JSONResponse(
                status_code=504,
                content={"error": {"message": "LLM timeout", "type": "upstream_timeout"}}
            )
        except Exception as e:
            err_name = type(e).__name__
            _safe_log(f"LiteLLM error: {err_name}")
            if context or partial_context:
                req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                fallback_ctx = partial_context if is_partial_triage else context
                return _build_safe_fallback_response(fallback_ctx, user_query, req_id, guided_triage=is_partial_triage)
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"Upstream error: {err_name}", "type": "upstream_error"}}
            )


@app.post("/v1/chat/completions/copilot")
async def chat_completions_copilot(request: ChatCompletionRequest):
    """
    Copilot flow endpoint using CopilotRouter + ConversationState.

    Features:
    - Conversation state expansion for short queries
    - Evidence labels in responses
    - Image input support via multimodal

    Extracts conversation_id from x-conversation-id header or generates from query hash.
    Before Juiz: expand short queries using conversation state.
    After Juiz: update conversation state with extracted data.
    """
    # Extract user message (handle both text and multimodal content)
    user_query = ""
    system_content = ""
    has_image = False

    for msg in request.messages:
        if msg.role == "user":
            content = msg.content
            # Handle multimodal content (string or list)
            if isinstance(content, str):
                user_query = content
            elif isinstance(content, list):
                # Multimodal message with text and/or image
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            user_query = item.get("text", "")
                        elif item.get("type") == "image_url":
                            has_image = True
            elif hasattr(content, "text"):
                user_query = content.text
        elif msg.role == "system":
            system_content = msg.content

    if not user_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request"}}
        )

    # Extract conversation_id from headers
    conversation_id = extract_conversation_id(request, user_query)

    # Before Juiz check: expand short queries using conversation state
    expanded_query = expand_query_with_state(conversation_id, user_query)

    # Juiz pre-flight check
    juez_result, juez_meta = juiz(expanded_query)
    _safe_log(f"[copilot] Juiz: {juez_result.value} reason={juez_meta.get('reason')} conv={conversation_id[:12]}...")

    if juez_result == JuizResult.BLOCKED:
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
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
            "evidence_labels": [],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
        if juez_meta.get("safety_only_without_model"):
            safety_msg = (
                "⚠️ Para procedimentos de segurança em alta tensão (IPM, placa inverter, "
                "ponte de diodos, capacitor, compressor), é obrigatório:\n\n"
                "1. DESLIGAR a unidade da rede elétrica\n"
                "2. AGUARDAR o tempo especificado no manual/fabricante/etiqueta\n"
                "3. CONFIRMAR ausência de tensão com multímetro antes de tocar componentes\n"
                "4. Usar EPIs adequados (luvas classe III, óculos, calçado isolante)\n"
                "5. NUNCA medir energizado sem respaldo explícito do manual\n\n"
                "─────────────────────────\n\n"
                "Para diagnóstico específico, forneça o MODELO COMPLETO da unidade. "
                "Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna)."
            )
        else:
            safety_msg = (
                "Para ajudar melhor, preciso do modelo completo da unidade. "
                "Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna). "
                "Com o modelo completo posso buscar o procedimento específico no manual."
            )
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": safety_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
            "evidence_labels": [],
        }

    if juez_result == JuizResult.GUIDED_TRIAGE:
        guided_msg = (
            "Você está com problema de código de erro no sistema VRV/VRF.\n\n"
            "Vou ajudar a identificar. Primeiro, qual é o subcódigo que aparece? "
            "(ex: E4-01, E4-001, E3-02)\n\n"
            "Dica: O subcódigo aparece após o código principal no display da unidade."
        )
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": guided_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
            "guided_triage": True,
            "evidence_labels": [],
        }

    # Juiz APPROVED - search Qdrant
    hits = await search_qdrant(expanded_query, top_k=DEFAULT_TOP_K)
    context = build_rag_context(hits)

    # After Juiz check: update conversation state with extracted data
    update_conversation_state(conversation_id, expanded_query, hits, juez_meta)

    # Build evidence labels from hits
    evidence_labels = []
    for i, hit in enumerate(hits):
        payload = hit.get("payload", {})
        evidence_labels.append({
            "chunk_id": i + 1,
            "doc_id": payload.get("doc_id", ""),
            "heading": payload.get("heading", ""),
            "doc_type": payload.get("doc_type", ""),
            "model_candidates": payload.get("model_candidates", [])[:3],
            "score": hit.get("score", 0),
        })

    # Check for partial match (family+error but no specific model)
    is_partial_triage, error_code, family = has_partial_match(hits, expanded_query)
    if is_partial_triage:
        partial_context = build_probable_triage_context(expanded_query, error_code, family)
    else:
        partial_context = ""

    # Use CopilotRouter for response generation
    try:
        copilot_result = await copilot_router.route(
            query=expanded_query,
            context=context or partial_context,
            hits=hits,
            conversation_id=conversation_id,
            has_image=has_image,
        )

        if copilot_result.get("fallback"):
            return {
                "id": "hvac-chat-completion",
                "object": "chat.completion",
                "created": 0,
                "model": COPILOT_MODEL_ID,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": copilot_result.get("content", ""),
                        },
                        "finish_reason": "stop",
                    }
                ],
                "evidence_labels": evidence_labels,
                "fallback": True,
            }

        # Return copilot result
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": copilot_result.get("content", ""),
                    },
                    "finish_reason": "stop",
                }
            ],
            "evidence_labels": evidence_labels,
        }

    except Exception as e:
        _safe_log(f"[copilot] Router error: {type(e).__name__}")
        # Fallback to strict flow on error
        if context or partial_context:
            req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
            fallback_ctx = partial_context if is_partial_triage else context
            return _build_safe_fallback_response(fallback_ctx, user_query, req_id, guided_triage=is_partial_triage)
        return JSONResponse(
            status_code=502,
            content={"error": {"message": f"Copilot error: {type(e).__name__}", "type": "upstream_error"}}
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
        if juez_meta.get("safety_only_without_model"):
            safety_msg = (
                "⚠️ PROCEDIMENTO GERAL DE SEGURANÇA:\n"
                "1. DESLIGAR a unidade da rede elétrica\n"
                "2. AGUARDAR o tempo especificado no manual/fabricante/etiqueta\n"
                "3. CONFIRMAR ausência de tensão com multímetro\n"
                "4. Usar EPIs adequados\n"
                "5. NUNCA medir energizado sem respaldo do manual\n\n"
                "─────────────────────────\n\n"
                "Para procedimento específico, forneça o MODELO COMPLETO. Ex: RXYQ20BRA + FXYC20BRA"
            )
        else:
            safety_msg = (
                "Para ajudar melhor, preciso do modelo completo da unidade. "
                "Exemplo: RXYQ20BRA + FXYC20BRA."
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
                        "content": safety_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.GUIDED_TRIAGE:
        guided_msg = (
            "Você está com problema de código de erro no sistema VRV/VRF.\n\n"
            "Vou ajudar a identificar. Primeiro, qual é o subcódigo que aparece? "
            "(ex: E4-01, E4-001, E3-02)\n\n"
            "Dica: O subcódigo aparece após o código principal no display da unidade."
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
                        "content": guided_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
            "guided_triage": True,
        }

    # Get Field Tutor enhanced context
    try:
        field_context = await _ft_mod.field_tutor_query(user_query)
    except Exception as e:
        _safe_log(f"[field-tutor] Error: {type(e).__name__}")
        field_context = "[Erro ao buscar contexto expandido]"

    # Build simplified prompt for LLM (already has context from Field Tutor)
    ft_system = FIELD_TUTOR_SYSTEM_PROMPT.format(context=field_context)

    messages_for_llm = [{"role": "system", "content": ft_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": msg.content})

    _safe_log(f"[field-tutor] context_chars={len(field_context)} {_log_query_meta(user_query)}")

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
                err_type = r.json().get("error", {}).get("type", "upstream_error") if r.text else "upstream_error"
                _safe_log(f"[field-tutor] LiteLLM error: status={r.status_code} type={err_type}")
                if field_context and "[Erro ao buscar" not in field_context:
                    req_id = hashlib.sha256(user_query.encode()).hexdigest()[:12]
                    return _build_safe_fallback_response(field_context, user_query, req_id, guided_triage=False)
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
        if juez_meta.get("safety_only_without_model"):
            safety_msg = (
                "⚠️ SEGURANÇA: DESLIGAR, AGUARDAR tempo do manual, "
                "CONFIRMAR ausência de tensão, usar EPIs, NUNCA medir energizado.\n\n"
                "Para procedimento específico: forneça modelo completo. Ex: RXYQ20BRA + FXYC20BRA"
            )
        else:
            safety_msg = "Forneça o modelo completo para busca no manual. Ex: RXYQ20BRA + FXYC20BRA"
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
                        "content": safety_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
        }

    if juez_result == JuizResult.GUIDED_TRIAGE:
        guided_msg = (
            "VRV/VRF - Problema de código de erro.\n\n"
            "Primeiro, qual o subcódigo que aparece? (ex: E4-01, E4-001, E3-02)\n\n"
            "Dica: O subcódigo aparece após o código principal no display."
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
                        "content": guided_msg,
                    },
                    "finish_reason": "stop",
                }
            ],
            "guided_triage": True,
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
    return {"status": "ok", "service": "hvac-rag-pipe", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "service": "HVAC RAG Pipe",
        "version": "1.0.0",
        "strategy": "openai_compatible_rag_pipe",
        "model": MODEL_NAME,
        "endpoints": ["/v1/models", "/v1/chat/completions", "/v1/chat/completions/copilot", "/health", "/hvac-rag/filter/inlet"],
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    _safe_log(f"Starting HVAC RAG Pipe on {PIPELINE_HOST}:{PIPELINE_PORT}")
    _safe_log(f"Qdrant: {QDRANT_URL} | Ollama: {OLLAMA_URL} | LiteLLM: {LITELLM_URL}")
    uvicorn.run(app, host=PIPELINE_HOST, port=PIPELINE_PORT, log_level="warning")
