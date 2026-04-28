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
import html
import hashlib
import os
import re
import json
import logging
import sys
import importlib.util
import urllib.parse
from typing import Any, Optional

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

# Import Conversation State module
_conv_mod = import_local_module("hvac_conversation_state", "hvac-conversation-state.py")
StateManager = _conv_mod.StateManager

# Import Guided Responses module
_guided_mod = import_local_module("hvac_guided_responses", "hvac-guided-responses.py")

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
COPILOT_TEMPERATURE = float(os.environ.get("HVAC_COPILOT_TEMPERATURE", "0.45"))
COPILOT_TOP_P = float(os.environ.get("HVAC_COPILOT_TOP_P", "0.90"))
COPILOT_MAX_TOKENS = int(os.environ.get("HVAC_COPILOT_MAX_TOKENS", "1400"))
COPILOT_EXTERNAL_SEARCH_ENABLED = os.environ.get("HVAC_COPILOT_EXTERNAL_SEARCH", "true").lower() not in {"0", "false", "no"}
MINIMAX_WEBSEARCH_URL = os.environ.get("MINIMAX_WEBSEARCH_URL", "").strip()
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "").strip()

# Limits
DEFAULT_TOP_K = 6
MAX_CONTEXT_CHARS = 7000
EMBED_TIMEOUT = 60
SEARCH_TIMEOUT = 20
CHAT_TIMEOUT = 120
WEB_SEARCH_TIMEOUT = 10

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
    "refrigerator", "washing machine", "television", "soccer",
    "recipe", "cake",
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
    headers = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        headers["Authorization"] = f"Bearer {QDRANT_API_KEY}"
    return headers


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
    raw_request: Optional[Request],
    user_query: str,
    request_body: Optional["ChatCompletionRequest"] = None,
) -> str:
    """
    Extract conversation_id from request headers or generate from user query hash.
    Looks for x-conversation-id header, falls back to hash-based generation.
    """
    if raw_request is not None:
        conversation_id = raw_request.headers.get("x-conversation-id", "").strip()
        if conversation_id:
            return conversation_id

    if request_body and request_body.conversation_id:
        return request_body.conversation_id.strip()

    # Generate from query hash as fallback
    q_hash = hashlib.sha256(user_query.encode()).hexdigest()[:16]
    return f"conv-{q_hash}"


def message_text(content: Any) -> str:
    """Extract plain text from string or OpenAI multimodal content."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
                elif item.get("type") == "image_url":
                    parts.append("[imagem enviada]")
        return " ".join(p for p in parts if p).strip()
    if hasattr(content, "text"):
        return str(content.text)
    return str(content or "")


def get_user_messages(messages: list["ChatMessage"]) -> list[str]:
    """Return non-empty user message texts in order."""
    return [
        text
        for msg in messages
        if msg.role == "user"
        for text in [message_text(msg.content)]
        if text
    ]


def state_snapshot(conversation_id: str) -> dict:
    """Return a serializable snapshot of current HVAC conversation state."""
    state = state_manager.get_state(conversation_id)
    return {
        "brand": state.brand,
        "family": state.family,
        "alarm_code": state.alarm_code,
        "subcode": state.subcode,
        "outdoor_model": state.outdoor_model,
        "indoor_model": state.indoor_model,
        "previous_answers": list(getattr(state, "previous_answers", [])),
    }


def compact_state_line(snapshot: dict) -> str:
    """Build compact state text for retrieval/judge prompts."""
    parts = []
    labels = {
        "brand": "marca",
        "family": "família",
        "alarm_code": "alarme",
        "subcode": "subcódigo",
        "outdoor_model": "unidade externa",
        "indoor_model": "unidade interna",
    }
    for key, label in labels.items():
        value = snapshot.get(key)
        if value:
            parts.append(f"{label}: {value}")
    return " | ".join(parts)


def build_effective_query(
    conversation_id: str,
    user_query: str,
    user_messages: list[str],
) -> str:
    """Use current turn, recent user history, and persisted state for routing."""
    snapshot = state_snapshot(conversation_id)
    state_line = compact_state_line(snapshot)
    recent_history = " | ".join(user_messages[-4:])
    parts = [f"pergunta atual: {user_query}"]
    if recent_history and recent_history != user_query:
        parts.append(f"histórico recente: {recent_history}")
    if state_line:
        parts.append(f"estado da conversa: {state_line}")
    return "\n".join(parts)


def merge_query_state(conversation_id: str, text: str) -> None:
    """Extract HVAC entities from text and merge them into conversation state."""
    extracted = state_manager.extract_from_query(text)
    updates = {k: v for k, v in extracted.items() if v}
    if updates:
        state_manager.update_state(conversation_id, **updates)


def update_conversation_state(conversation_id: str, user_query: str, hits: list, juez_meta: dict) -> None:
    """
    Update conversation state after Juiz check with extracted data.
    """
    merge_query_state(conversation_id, user_query)

    # Check hits for additional context
    updates = {}
    state = state_manager.get_state(conversation_id)
    if hits and not state.outdoor_model:
        for hit in hits[:3]:
            payload = hit.get("payload", {})
            hit_models = payload.get("model_candidates", [])
            for hm in hit_models:
                extracted = state_manager.extract_from_query(str(hm))
                if extracted.get("outdoor_model"):
                    updates["outdoor_model"] = extracted["outdoor_model"]
                    break

    if updates:
        state_manager.update_state(conversation_id, **updates)


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


COPILOT_SYSTEM_PROMPT_TEMPLATE = """Você é o hvac-copilot em estilo Hermes para técnicos de ar-condicionado.

MODO: conversational_tutor_ptbr.

REGRAS DE ESTILO:
1. Responda em português do Brasil, direto, fluido e útil.
2. Comece de forma natural, por exemplo: "Entendi..." ou "O caminho provável é...".
3. Não responda como laudo rígido, formulário ou auditoria.
4. Não peça o modelo completo repetidamente quando o histórico já trouxe modelo, marca, família ou alarme.
5. Faça uma pergunta simples por vez no final.
6. Use frases de segurança quando aplicável: "Não vou cravar peça ainda..." e "Se você for técnico, faça com segurança...".

REGRAS DE EVIDÊNCIA:
1. Use a melhor evidência disponível nesta ordem:
   Manual exato > Manual da família > Graph interno > Fonte externa oficial > Busca web fallback.
2. Rotule a resposta com "Evidência: <label>".
3. Se não houver manual exato, ajude com pista segura; não encerre em "não encontrei no manual".
4. Nunca invente tensão, resistência, pressão, frequência, corrente ou carga de refrigerante.

REGRAS DE SEGURANÇA:
1. Medição energizada só pode ser descrita quando o manual explícito do modelo autorizar.
2. Para IPM, placa inverter, alta tensão, capacitor, compressor, ponte de diodos, DC bus ou refrigerante, avise risco e peça manual/modelo quando faltar contexto.
3. Cliente leigo recebe orientação segura e não invasiva.
4. Bloqueie assuntos fora do escopo HVAC do pipe.

ESTADO DA CONVERSA:
{state}

EVIDÊNCIA ATUAL: {evidence}

CONTEXTO HVAC:
{context}

Responda usando o histórico da conversa e o estado acima. Termine com exatamente uma pergunta simples quando precisar avançar a triagem."""


def format_copilot_system_prompt(context: str, snapshot: dict, evidence: str) -> str:
    state_line = compact_state_line(snapshot) or "[sem estado extraído ainda]"
    ctx = context if context else "[sem trecho de manual exato recuperado]"
    return COPILOT_SYSTEM_PROMPT_TEMPLATE.format(
        state=state_line,
        evidence=evidence,
        context=ctx,
    )


def evidence_level_from_hits(hits: list, snapshot: dict, partial_context: str = "") -> str:
    """Classify the best evidence level available for this answer."""
    if not hits:
        return "Graph interno" if partial_context else "Graph interno"

    exact_models = {
        str(snapshot.get("outdoor_model") or "").upper(),
        str(snapshot.get("indoor_model") or "").upper(),
    }
    exact_models.discard("")

    for hit in hits:
        payload = hit.get("payload", {})
        candidates = [str(m).upper() for m in payload.get("model_candidates", [])]
        if exact_models and any(model in candidates for model in exact_models):
            return "Manual exato"

    return "Manual da família"


def build_evidence_labels(hits: list, evidence_level: str) -> list[dict]:
    labels = []
    for i, hit in enumerate(hits):
        payload = hit.get("payload", {})
        labels.append({
            "chunk_id": i + 1,
            "evidence": evidence_level,
            "doc_id": payload.get("doc_id", ""),
            "heading": payload.get("heading", ""),
            "doc_type": payload.get("doc_type", ""),
            "model_candidates": payload.get("model_candidates", [])[:3],
            "score": hit.get("score", 0),
        })
    if not labels:
        labels.append({"evidence": evidence_level})
    return labels


def should_try_external_search(juez_result: JuizResult, juez_meta: dict, hits: list, context: str) -> bool:
    """Return true when policy allows external search after internal evidence is insufficient."""
    if not COPILOT_EXTERNAL_SEARCH_ENABLED or hits or context:
        return False
    if juez_meta.get("safety_only_without_model") or juez_meta.get("is_out_of_domain"):
        return False
    if juez_meta.get("can_use_web_official") or juez_meta.get("can_use_duckduckgo_fallback"):
        return True
    return juez_result in {
        JuizResult.WEB_OFFICIAL_ASSISTED,
        JuizResult.MANUAL_EXACT,
        JuizResult.MANUAL_FAMILY,
        JuizResult.GRAPH_ASSISTED,
    }


def build_official_web_query(effective_query: str, snapshot: dict) -> str:
    """Build a manufacturer-focused search query without leaking internal state."""
    brand = str(snapshot.get("brand") or "").lower()
    domain_hint = {
        "daikin": "(site:daikin.com OR site:daikin.com.br)",
        "carrier": "(site:carrier.com OR site:carrier.com.br)",
        "midea": "(site:midea.com OR site:midea.com.br)",
        "lg": "site:lg.com",
        "samsung": "site:samsung.com",
        "gree": "site:gree.com",
        "mitsubishi": "site:mitsubishielectric.com",
        "hitachi": "site:hitachiaircon.com",
        "panasonic": "site:panasonic.com",
        "fujitsu": "site:fujitsu-general.com",
        "toshiba": "site:toshiba-aircon.co.uk",
    }.get(brand, "")

    focused_terms = [
        str(snapshot.get("outdoor_model") or ""),
        str(snapshot.get("indoor_model") or ""),
        " ".join(x for x in [snapshot.get("alarm_code"), snapshot.get("subcode")] if x),
        str(snapshot.get("family") or ""),
        "manual service troubleshooting",
    ]
    terms = " ".join(term for term in focused_terms if term).strip()
    query = f"{terms} {effective_query}".strip()
    return f"{query} {domain_hint}".strip()


def normalize_external_results(raw: Any, source: str) -> list[dict]:
    """Normalize MiniMax/DuckDuckGo-like search payloads into title/url/snippet items."""
    if not raw:
        return []

    candidates = raw
    if isinstance(raw, dict):
        for key in ("results", "items", "data"):
            if isinstance(raw.get(key), list):
                candidates = raw[key]
                break
            if isinstance(raw.get(key), dict):
                return normalize_external_results(raw[key], source)

    if not isinstance(candidates, list):
        return []

    results = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("name") or item.get("text") or "").strip()
        url = str(item.get("url") or item.get("link") or item.get("href") or "").strip()
        snippet = str(item.get("snippet") or item.get("summary") or item.get("content") or "").strip()
        if not title or not url.startswith(("http://", "https://")):
            continue
        results.append({
            "title": html.unescape(title)[:180],
            "url": url,
            "snippet": html.unescape(snippet)[:260],
            "source": source,
        })
        if len(results) >= 5:
            break
    return results


def decode_duckduckgo_url(url: str) -> str:
    """Decode DuckDuckGo redirect URLs when possible."""
    parsed = urllib.parse.urlparse(html.unescape(url))
    if parsed.query:
        params = urllib.parse.parse_qs(parsed.query)
        uddg = params.get("uddg")
        if uddg:
            return uddg[0]
    return urllib.parse.urljoin("https://duckduckgo.com", html.unescape(url))


def parse_duckduckgo_html(page: str) -> list[dict]:
    """Extract a small set of result links from DuckDuckGo HTML."""
    matches = re.findall(
        r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        page,
        flags=re.IGNORECASE | re.DOTALL,
    )
    results = []
    for raw_url, raw_title in matches:
        title = re.sub(r"<[^>]+>", "", raw_title)
        url = decode_duckduckgo_url(raw_url)
        if title and url.startswith(("http://", "https://")):
            results.append({
                "title": html.unescape(title).strip()[:180],
                "url": url,
                "snippet": "",
                "source": "duckduckgo",
            })
        if len(results) >= 5:
            break
    return results


async def search_minimax_official_web(query: str) -> list[dict]:
    """Try MiniMax official web search when a compatible endpoint is configured."""
    if not (MINIMAX_WEBSEARCH_URL and MINIMAX_API_KEY):
        return []

    headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}", "Content-Type": "application/json"}
    payload = {"query": query, "source": "official", "num_results": 5}
    async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT) as client:
        try:
            response = await client.post(MINIMAX_WEBSEARCH_URL, headers=headers, json=payload)
            if response.status_code == 200:
                return normalize_external_results(response.json(), "minimax_mcp")
            _safe_log(f"[copilot] MiniMax web_search unavailable status={response.status_code}")
        except Exception as e:
            _safe_log(f"[copilot] MiniMax web_search error: {type(e).__name__}")
    return []


async def search_duckduckgo_fallback(query: str) -> list[dict]:
    """Fallback web search using DuckDuckGo HTML results."""
    headers = {"User-Agent": "hvac-copilot/1.0"}
    async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
        try:
            response = await client.post(
                "https://html.duckduckgo.com/html/",
                headers=headers,
                data={"q": query},
            )
            if response.status_code == 200:
                return parse_duckduckgo_html(response.text)
            _safe_log(f"[copilot] DuckDuckGo fallback unavailable status={response.status_code}")
        except Exception as e:
            _safe_log(f"[copilot] DuckDuckGo fallback error: {type(e).__name__}")
    return []


async def search_external_sources(effective_query: str, snapshot: dict) -> tuple[str, Optional[str], list[dict]]:
    """Search external sources in the configured order and return context plus evidence labels."""
    search_query = build_official_web_query(effective_query, snapshot)
    minimax_results = await search_minimax_official_web(search_query)
    if minimax_results:
        return build_external_context(minimax_results, "Fonte externa oficial"), "Fonte externa oficial", [
            {"evidence": "Fonte externa oficial", **result} for result in minimax_results
        ]

    ddg_results = await search_duckduckgo_fallback(search_query)
    if ddg_results:
        return build_external_context(ddg_results, "Busca web fallback"), "Busca web fallback", [
            {"evidence": "Busca web fallback", **result} for result in ddg_results
        ]

    return "", None, []


def build_external_context(results: list[dict], evidence: str) -> str:
    """Build compact external-source context for the copilot prompt."""
    chunks = []
    for i, result in enumerate(results[:5], 1):
        chunk = (
            f"[Fonte externa {i}] Evidência: {evidence} | Origem: {result.get('source', 'web')}\n"
            f"Título: {result.get('title', '')}\n"
            f"URL: {result.get('url', '')}"
        )
        if result.get("snippet"):
            chunk += f"\nTrecho: {result['snippet']}"
        chunks.append(chunk)
    return "\n\n".join(chunks)


def build_copilot_blocked_response(user_query: str) -> str:
    return (
        "Entendi, mas vou bloquear aqui: esta base é para ar-condicionado, "
        "climatização e VRV/VRF. Não vou misturar procedimento de geladeira, "
        "freezer ou outro equipamento fora do escopo.\n\n"
        "Evidência: Graph interno\n\n"
        "Confirma uma coisa simples: sua dúvida é sobre ar-condicionado/VRV/VRF?"
    )


def build_copilot_safety_gate(snapshot: dict) -> str:
    model_hint = snapshot.get("outdoor_model") or "modelo da unidade externa"
    return (
        "Entendi. Como envolve IPM/placa inverter/alta tensão, vou segurar a parte perigosa.\n\n"
        "Evidência: Graph interno\n\n"
        "Não vou orientar medição energizada sem manual explícito do modelo. "
        "Se você for técnico, faça com segurança: desligamento, bloqueio, espera de descarga "
        "conforme etiqueta/manual, EPI e confirmação de ausência de tensão antes de tocar.\n\n"
        "Para avançar sem inventar valor técnico, preciso casar o procedimento com o manual correto.\n\n"
        f"Confirma uma coisa simples: qual é o modelo completo da unidade externa? "
        f"(tenho como pista: {model_hint})"
    )


def build_copilot_clarification(snapshot: dict) -> str:
    state_line = compact_state_line(snapshot)
    prefix = f"Entendi. Já tenho esta pista: {state_line}.\n\n" if state_line else "Entendi.\n\n"
    return (
        prefix +
        "O caminho provável é identificar primeiro o dado mínimo que falta, sem transformar isso em formulário.\n\n"
        "Evidência: Graph interno\n\n"
        "Confirma uma coisa simples: qual é o código de alarme ou modelo que aparece na etiqueta/display?"
    )


def build_copilot_guided_triage(effective_query: str, snapshot: dict) -> str:
    query_lower = effective_query.lower()
    if re.search(r"\bu4\b", effective_query, re.IGNORECASE) and snapshot.get("subcode"):
        brand = str(snapshot.get("brand") or "").title()
        family = str(snapshot.get("family") or "").upper()
        subcode = snapshot.get("subcode")
        system = " ".join(x for x in [brand, family] if x).strip() or "esse sistema"
        return (
            f"Entendi. Já tenho {system} com U4-{subcode}. O caminho provável é comunicação entre unidades, "
            "então não vou cravar placa antes de separar cabo, borne, alimentação e endereçamento.\n\n"
            "Evidência: Graph interno\n\n"
            "Para procedimento exato eu preciso casar isso com a unidade externa/interna correta, sem transformar a triagem em formulário.\n\n"
            "Confirma uma coisa simples: qual é o modelo da unidade externa?"
        )

    if "daikin" in query_lower and "vrv" in query_lower and re.search(r"\be4\b", effective_query, re.IGNORECASE):
        return (
            "Entendi. Em Daikin VRV/VRF, o E4 é uma família de alarme ligada a baixa pressão no circuito de refrigerante.\n\n"
            "Evidência: Graph interno\n\n"
            "Não vou cravar peça ainda, porque o significado muda pelo subcódigo e pela unidade que reportou. "
            "Como pista segura: E4-01/E4-001 costuma apontar para baixa pressão na unidade Master; "
            "E4-02/E4-002 e E4-03/E4-003 variam por unidade/slave.\n\n"
            "Se você for técnico, faça com segurança e não intervenha no circuito de refrigerante sem o manual do modelo.\n\n"
            "Confirma uma coisa simples: aparece E4-01/E4-001, E4-02/E4-002 ou outro subcódigo?"
        )

    guided = _guided_mod.build_guided_response(effective_query)
    if guided:
        return (
            "Entendi. Vou seguir por triagem guiada, sem pedir tudo de uma vez.\n\n"
            "Evidência: Graph interno\n\n"
            f"{guided}\n\n"
            "Confirma uma coisa simples: qual subcódigo aparece no display?"
        )

    alarm = snapshot.get("alarm_code") or "o alarme"
    return (
        f"Entendi. Para {alarm}, o caminho provável é confirmar o subcódigo antes de cravar causa.\n\n"
        "Evidência: Graph interno\n\n"
        "Não vou pedir uma ficha completa agora; primeiro vamos fechar a pista principal.\n\n"
        "Confirma uma coisa simples: qual é o subcódigo que aparece no display?"
    )


def build_copilot_local_response(effective_query: str, snapshot: dict, evidence: str, context: str = "") -> str:
    """Safe local answer when LiteLLM is unavailable or no exact manual exists."""
    alarm = str(snapshot.get("alarm_code") or "").upper()
    brand = str(snapshot.get("brand") or "").title()
    family = str(snapshot.get("family") or "").upper()
    outdoor = snapshot.get("outdoor_model")
    indoor = snapshot.get("indoor_model")

    if alarm == "U4" or re.search(r"\bu4\b", effective_query, re.IGNORECASE):
        equipment = " + ".join(x for x in [outdoor, indoor] if x) or f"{brand} {family}".strip() or "esse sistema"
        return (
            f"Entendi. Para {equipment} com U4, o caminho provável é comunicação entre unidades/controle, não troca direta de peça.\n\n"
            f"Evidência: {evidence}\n\n"
            "As causas mais comuns para investigar primeiro são: interligação/comunicação rompida ou com mau contato, "
            "conector oxidado ou frouxo, endereçamento/configuração entre unidades, alimentação instável de placa, "
            "ou falha de placa depois que o cabeamento e a alimentação forem eliminados.\n\n"
            "Não vou cravar placa ainda. Se você for técnico, faça com segurança e só avance para medições seguindo o manual do modelo.\n\n"
            "Confirma uma coisa simples: o U4 aparece em todas as evaporadoras ou só em uma unidade?"
        )

    if alarm == "E4" or re.search(r"\be4\b", effective_query, re.IGNORECASE):
        return build_copilot_guided_triage(effective_query, snapshot)

    if evidence in {"Fonte externa oficial", "Busca web fallback"} and context:
        return (
            "Entendi. Não achei manual interno suficiente para cravar procedimento, então subi um degrau na evidência externa.\n\n"
            f"Evidência: {evidence}\n\n"
            f"{context[:1400]}\n\n"
            "Use isso como pista de documentação, não como autorização para medição ou troca de peça. "
            "Valores elétricos, pressão e carga de refrigerante continuam dependendo do manual do modelo.\n\n"
            "Confirma uma coisa simples: você quer que eu procure o procedimento pelo modelo exato ou pelo código de alarme?"
        )

    if context:
        return (
            "Entendi. Achei contexto técnico, mas vou manter como triagem segura em vez de laudo fechado.\n\n"
            f"Evidência: {evidence}\n\n"
            "O caminho provável é comparar o sintoma com o trecho recuperado e confirmar o dado que falta antes de partir para procedimento invasivo. "
            "Não vou inventar valores elétricos, pressão ou carga de refrigerante.\n\n"
            "Confirma uma coisa simples: qual alarme ou sintoma aparece agora no display?"
        )

    return (
        "Entendi. Ainda não tenho manual exato suficiente para cravar procedimento, mas dá para seguir por triagem segura.\n\n"
        f"Evidência: {evidence}\n\n"
        "O caminho provável é fechar primeiro família, alarme e unidade que reportou o problema. "
        "Não vou pedir tudo de uma vez nem inventar valores técnicos.\n\n"
        "Confirma uma coisa simples: qual código completo aparece no display?"
    )


def is_model_update_only(user_query: str) -> bool:
    """Detect turns where the user is only supplying model identifiers."""
    has_model = bool(re.search(r"\b[A-Z]{2,10}[0-9]{1,6}[A-Z0-9]*\b", user_query, re.IGNORECASE))
    words = re.findall(r"\w+", user_query)
    return has_model and len(words) <= 4


def build_model_update_ack(snapshot: dict) -> str:
    outdoor = snapshot.get("outdoor_model") or "unidade externa informada"
    indoor = snapshot.get("indoor_model")
    alarm = snapshot.get("alarm_code")
    subcode = snapshot.get("subcode")
    alarm_label = f"{alarm}-{subcode}" if alarm and subcode else (alarm or "alarme")
    models = " + ".join(x for x in [outdoor, indoor] if x)
    return (
        f"Entendi. Modelo anotado: {models}. Vou manter isso no contexto para o {alarm_label}.\n\n"
        "Evidência: Graph interno\n\n"
        "Não vou cravar peça ainda; agora dá para seguir sem pedir modelo de novo. "
        "O caminho provável é separar comunicação/cabeamento, alimentação e endereçamento antes de suspeitar placa.\n\n"
        "Confirma uma coisa simples: você quer as causas mais comuns ou uma sequência de verificação segura?"
    )


def local_copilot_short_circuit(user_query: str, effective_query: str, snapshot: dict) -> Optional[str]:
    """Deterministic answers for known risky follow-ups that should not rely on LLM creativity."""
    alarm = str(snapshot.get("alarm_code") or "").upper()
    query_lower = user_query.lower()

    if alarm == "U4" and is_model_update_only(user_query):
        return build_model_update_ack(snapshot)

    if alarm == "U4" and any(term in query_lower for term in ["causa", "causas", "comuns", "provável", "provavel"]):
        return build_copilot_local_response(effective_query, snapshot, "Graph interno")

    return None


def normalize_copilot_content(content: str, evidence: str) -> str:
    """Ensure LLM output keeps the required evidence label and no leading noise."""
    text = (content or "").strip()
    if "evidência:" not in text.lower() and "evidencia:" not in text.lower():
        text = f"{text}\n\nEvidência: {evidence}"
    return text


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
    content: Any


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 1024
    stream: Optional[bool] = False
    conversation_id: Optional[str] = None


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
async def chat_completions(request: ChatCompletionRequest, raw_request: Request):
    """
    OpenAI-compatible /v1/chat/completions endpoint.
    Routes to copilot flow if model is hvac-copilot, otherwise uses existing strict flow.
    """
    # Route to copilot flow if hvac-copilot model
    if request.model == "hvac-copilot":
        return await chat_completions_copilot(request, raw_request)

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
async def chat_completions_copilot(request: ChatCompletionRequest, raw_request: Request):
    """
    Hermes-style copilot flow.

    Uses full message history plus persisted conversation state before judging,
    so follow-up questions inherit brand/family/alarm/model from earlier turns.
    """
    user_messages = get_user_messages(request.messages)
    user_query = user_messages[-1] if user_messages else ""
    system_content = ""
    has_image = any(
        isinstance(msg.content, list)
        and any(isinstance(item, dict) and item.get("type") == "image_url" for item in msg.content)
        for msg in request.messages
    )

    for msg in request.messages:
        if msg.role == "system":
            system_content = message_text(msg.content)

    if not user_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request"}}
        )

    conversation_id = extract_conversation_id(raw_request, user_query, request)
    merge_query_state(conversation_id, user_query)
    effective_query = build_effective_query(conversation_id, user_query, user_messages)
    snapshot = state_snapshot(conversation_id)

    juez_result, juez_meta = juiz(effective_query)
    _safe_log(
        f"[copilot] Juiz: {juez_result.value} reason={juez_meta.get('reason')} "
        f"conv={conversation_id[:12]}... {_log_query_meta(user_query)}"
    )

    if juez_result == JuizResult.BLOCKED:
        blocked_msg = build_copilot_blocked_response(user_query)
        state_manager.update_state(conversation_id, previous_answers=[blocked_msg[:280]], last_mode="blocked")
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": blocked_msg}, "finish_reason": "stop"}],
            "evidence_labels": [{"evidence": "Graph interno"}],
        }

    if juez_result == JuizResult.ASK_CLARIFICATION:
        if juez_meta.get("safety_only_without_model"):
            clarification_msg = build_copilot_safety_gate(snapshot)
        else:
            clarification_msg = build_copilot_clarification(snapshot)
        state_manager.update_state(conversation_id, previous_answers=[clarification_msg[:280]], last_mode="clarification")
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": clarification_msg}, "finish_reason": "stop"}],
            "evidence_labels": [{"evidence": "Graph interno"}],
        }

    if juez_result == JuizResult.GUIDED_TRIAGE:
        guided_msg = build_copilot_guided_triage(effective_query, snapshot)
        state_manager.update_state(conversation_id, previous_answers=[guided_msg[:280]], last_mode="guided_triage", evidence_seen=["Graph interno"])
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": guided_msg}, "finish_reason": "stop"}],
            "guided_triage": True,
            "evidence_labels": [{"evidence": "Graph interno"}],
        }

    local_msg = local_copilot_short_circuit(user_query, effective_query, snapshot)
    if local_msg:
        state_manager.update_state(
            conversation_id,
            previous_answers=[local_msg[:280]],
            last_mode="copilot_local_graph",
            evidence_seen=["Graph interno"],
        )
        return {
            "id": "hvac-chat-completion",
            "object": "chat.completion",
            "created": 0,
            "model": COPILOT_MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": local_msg}, "finish_reason": "stop"}],
            "evidence_labels": [{"evidence": "Graph interno"}],
        }

    hits = await search_qdrant(effective_query, top_k=DEFAULT_TOP_K)
    context = build_rag_context(hits)
    update_conversation_state(conversation_id, effective_query, hits, juez_meta)
    snapshot = state_snapshot(conversation_id)

    is_partial_triage, error_code, family = has_partial_match(hits, effective_query)
    partial_context = build_probable_triage_context(effective_query, error_code, family) if is_partial_triage else ""
    evidence = evidence_level_from_hits(hits, snapshot, partial_context)
    evidence_labels = build_evidence_labels(hits, evidence)

    final_context = context or partial_context
    if should_try_external_search(juez_result, juez_meta, hits, final_context):
        external_context, external_evidence, external_labels = await search_external_sources(effective_query, snapshot)
        if external_context and external_evidence:
            final_context = external_context
            evidence = external_evidence
            evidence_labels = external_labels

    final_system = format_copilot_system_prompt(final_context, snapshot, evidence)
    if system_content:
        final_system = f"{final_system}\n\n[System original do usuário]\n{system_content}"

    messages_for_llm = [{"role": "system", "content": final_system}]
    for msg in request.messages:
        if msg.role != "system":
            messages_for_llm.append({"role": msg.role, "content": message_text(msg.content)})

    _safe_log(
        f"[copilot] Qdrant: hits={len(hits)} context_chars={len(final_context)} "
        f"evidence={evidence.replace(' ', '_')} image={has_image} {_log_query_meta(user_query)}"
    )

    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        try:
            litellm_payload = {
                "model": "minimax-m2.7",
                "messages": messages_for_llm,
                "temperature": COPILOT_TEMPERATURE,
                "top_p": COPILOT_TOP_P,
                "max_tokens": COPILOT_MAX_TOKENS if request.max_tokens in (None, 1024) else request.max_tokens,
                "stream": False,
            }
            r = await client.post(
                f"{LITELLM_URL}/chat/completions",
                headers=litellm_headers(),
                json=litellm_payload,
            )
            if r.status_code == 200:
                result = r.json()
                result["model"] = COPILOT_MODEL_ID
                result["evidence_labels"] = evidence_labels
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    content = normalize_copilot_content(content, evidence)
                    result["choices"][0]["message"]["content"] = content
                    state_manager.update_state(
                        conversation_id,
                        previous_answers=[content[:280]],
                        last_mode="copilot",
                        evidence_seen=[evidence],
                    )
                return result

            err_type = r.json().get("error", {}).get("type", "upstream_error") if r.text else "upstream_error"
            _safe_log(f"[copilot] LiteLLM error: status={r.status_code} type={err_type}")
        except httpx.TimeoutException:
            _safe_log("[copilot] LiteLLM timeout")
        except Exception as e:
            _safe_log(f"[copilot] LiteLLM error: {type(e).__name__}")

    fallback_msg = build_copilot_local_response(effective_query, snapshot, evidence, final_context)
    state_manager.update_state(
        conversation_id,
        previous_answers=[fallback_msg[:280]],
        last_mode="copilot_fallback",
        evidence_seen=[evidence],
    )
    return {
        "id": "hvac-chat-completion",
        "object": "chat.completion",
        "created": 0,
        "model": COPILOT_MODEL_ID,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": fallback_msg}, "finish_reason": "stop"}],
        "evidence_labels": evidence_labels,
        "fallback": True,
    }


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
