"""
HVAC Memory Context — Fetch + Writeback para o pipe RAG.
Busca memórias de 3 fontes (Mem0, Postgres, Qdrant) e permite writeback
após cada interação com o MiniMax.
"""

import asyncio
import hashlib
import logging
import os
import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
import pg8000
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

# Carregar .env se existir
# Tentar carregar .env se existir
try:
    load_dotenv("/srv/monorepo/.env")
except Exception:
    pass

# =============================================================================
# Config — valores do .env ou defaults
# =============================================================================
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
MEM0_COLLECTION = os.getenv("MEM0_COLLECTION", "will")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

_qdrant_parsed = urlparse(QDRANT_URL)
QDRANT_HOST = _qdrant_parsed.hostname or "localhost"
QDRANT_PORT = _qdrant_parsed.port or 6333

MAX_TOTAL_MEMORIES = 12
MAX_CONTEXT_TOKENS = 2500
CHARS_PER_TOKEN = 4

# =============================================================================
# Secrets blocklist — never save content containing these patterns
# =============================================================================
SECRET_PATTERNS = [
    "api_key", "password", "token", "sk-", "secret",
    "cfk_", "cfut_", "ghp_", "ghs_", "sk-cp-",
]


def _is_secret_free(text: str) -> bool:
    lower = text.lower()
    return not any(p.lower() in lower for p in SECRET_PATTERNS)


def _content_hash(content: str) -> str:
    return hashlib.md5(content.encode()).hexdigest()


def _summarize(text: str, max_words: int = 30) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."


def _estimate_tokens(chars: int) -> int:
    return chars // CHARS_PER_TOKEN


async def _embed_ollama(text: str) -> list[float]:
    """Embedding via Ollama nomic-embed-text API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]


# =============================================================================
# Mem0 client (lazy init — singleton)
# =============================================================================

_mem0_client = None


def _get_mem0():
    """Return singleton Memory instance via Memory.from_config()."""
    global _mem0_client
    if _mem0_client is not None:
        return _mem0_client

    from mem0 import Memory

    # Pre-authenticated QdrantClient to avoid SSL issues with host+port
    qc = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY if QDRANT_API_KEY else None,
        check_compatibility=False,
    )

    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": MEM0_COLLECTION,
                "client": qc,
            },
        },
        "llm": {
            "provider": "ollama",
            "config": {
                "model": "qwen2.5:3b",
                "ollama_base_url": OLLAMA_URL,
            },
        },
        "embedder": {
            "provider": "ollama",
            "config": {
                "model": OLLAMA_EMBED_MODEL,
                "ollama_base_url": OLLAMA_URL,
            },
        },
    }

    try:
        _mem0_client = Memory.from_config(config)
        logger.info(f"[memory] Mem0 initialized, collection={MEM0_COLLECTION}")
    except Exception as exc:
        logger.warning(f"[memory] Mem0 init failed: {exc}. Using in-memory fallback.")
        from mem0 import Memory as InMemoryMem
        _mem0_client = InMemoryMem()

    return _mem0_client


# =============================================================================
# Context Fetch — 3 fontes em paralelo
# =============================================================================


async def _fetch_mem0(user_id: str, domain: str = "hvac", limit: int = 6) -> tuple[list[dict], dict]:
    """Fetch from Mem0 by user_id + domain via Memory.search()."""
    source_info = {}
    results = []
    try:
        client = _get_mem0()
        raw = client.search(
            query=f"domain:{domain}",
            top_k=limit,
            filters={"user_id": user_id},
        )
        # Mem0.search pode retornar dict {"results": [...]} ou list
        items = raw.get("results", []) if isinstance(raw, dict) else (raw or [])
        for item in items:
            text = item.get("text", "") or item.get("content", "")
            if text:
                results.append({
                    "content": text,
                    "source": "mem0",
                    "memory_id": str(item.get("id", "")),
                    "confidence": item.get("score", 0.5),
                    "tags": item.get("labels", []) or item.get("tags", []),
                })
        source_info["mem0"] = {"count": len(results), "status": "ok"}
    except Exception as exc:
        logger.warning(f"[memory] Mem0 unavailable: {exc}")
        source_info["mem0"] = {"count": 0, "status": f"error: {exc}"}
    return results, source_info


async def _fetch_postgres(conversation_id: str, limit: int = 4) -> tuple[list[dict], dict]:
    """Fetch from hvac_memory.agent_memory_events by conversation_id."""
    source_info = {}
    results = []
    conn = None
    try:
        conn = pg8000.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, content, metadata, created_at, event_type
            FROM hvac_memory.agent_memory_events
            WHERE conversation_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (conversation_id, limit),
        )
        rows = cursor.fetchall()
        for row in rows:
            content = row[1] if len(row) > 1 else ""
            if content:
                metadata = {}
                try:
                    metadata = json.loads(row[2]) if len(row) > 2 and row[2] else {}
                except Exception:
                    pass
                results.append({
                    "content": content,
                    "source": "postgres",
                    "memory_id": str(row[0]) if len(row) > 0 else "",
                    "event_type": row[4] if len(row) > 4 else "",
                    "metadata": metadata,
                    "confidence": 0.7,
                })
        cursor.close()
        source_info["postgres"] = {"count": len(results), "status": "ok"}
    except pg8000.exceptions.InterfaceError as exc:
        logger.warning(f"[memory] Postgres unavailable: {exc}")
        source_info["postgres"] = {"count": 0, "status": f"error: {exc}"}
    except Exception as exc:
        logger.warning(f"[memory] Postgres error: {exc}")
        source_info["postgres"] = {"count": 0, "status": f"error: {exc}"}
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
    return results, source_info


async def _fetch_qdrant(query: str, domain: str = "hvac", limit: int = 3) -> tuple[list[dict], dict]:
    """Semantic search in Qdrant (hvac_manuals_v1) — embeds query via Ollama."""
    source_info = {}
    results = []
    try:
        vector = await _embed_ollama(query)
        client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY if QDRANT_API_KEY else None,
            check_compatibility=False,
        )
        search_filter = Filter(
            must=[
                FieldCondition(key="domain", match=MatchValue(value=domain)),
                FieldCondition(key="status", match=MatchValue(value="active")),
            ]
        )
        hits = client.query_points(
            collection_name="hvac_manuals_v1",
            query=vector,
            query_filter=search_filter,
            limit=limit,
        )
        for hit in hits:
            payload = hit.payload or {}
            text = payload.get("text", "") or payload.get("content", "")
            if text:
                results.append({
                    "content": text[:500],
                    "source": "qdrant",
                    "memory_id": str(hit.id),
                    "confidence": hit.score,
                    "payload": payload,
                })
        source_info["qdrant"] = {"count": len(results), "status": "ok"}
    except Exception as exc:
        logger.warning(f"[memory] Qdrant unavailable: {exc}")
        source_info["qdrant"] = {"count": 0, "status": f"error: {exc}"}
    return results, source_info


async def context_fetch(
    user_id: str,
    conversation_id: str,
    query: str,
    domain: str = "hvac",
) -> dict:
    """
    Busca memória de 3 fontes em paralelo.

    Returns:
        {
            "user_preferences": list[str],
            "product_decisions": list[str],
            "domain_rules": list[str],
            "conversation_state": dict,
            "recent_relevant_memories": list[str],
            "source_summary": dict,
        }
    """
    mem0_task = _fetch_mem0(user_id, domain, limit=6)
    pg_task = _fetch_postgres(conversation_id, limit=4)
    qdrant_task = _fetch_qdrant(query, domain, limit=3)

    mem0_res, pg_res, qdrant_res = await asyncio.gather(
        mem0_task, pg_task, qdrant_task, return_exceptions=True
    )

    if isinstance(mem0_res, Exception):
        mem0_items, mem0_src = [], {"mem0": {"count": 0, "status": f"exception: {mem0_res}"}}
    else:
        mem0_items, mem0_src = mem0_res

    if isinstance(pg_res, Exception):
        pg_items, pg_src = [], {"postgres": {"count": 0, "status": f"exception: {pg_res}"}}
    else:
        pg_items, pg_src = pg_res

    if isinstance(qdrant_res, Exception):
        qdrant_items, qdrant_src = [], {"qdrant": {"count": 0, "status": f"exception: {qdrant_res}"}}
    else:
        qdrant_items, qdrant_src = qdrant_res

    source_summary = {**mem0_src, **pg_src, **qdrant_src}

    all_memories = mem0_items + pg_items + qdrant_items

    # Deduplicar por hash
    seen_hashes = set()
    deduped = []
    for mem in all_memories:
        h = _content_hash(mem["content"])
        if h not in seen_hashes:
            seen_hashes.add(h)
            deduped.append(mem)

    # Ordenar: active/high-confidence primeiro
    def sort_key(mem: dict) -> tuple:
        conf = mem.get("confidence", 0.0)
        tags = mem.get("tags", [])
        is_active = "active" in [t.lower() for t in tags] if tags else False
        return (0 if is_active else 1, -conf)

    deduped.sort(key=sort_key)
    deduped = deduped[:MAX_TOTAL_MEMORIES]

    user_preferences = []
    product_decisions = []
    domain_rules = []
    conversation_state = {}
    recent_relevant = []

    for mem in deduped:
        content = mem["content"]
        source = mem["source"]
        tags = mem.get("tags", [])
        metadata = mem.get("metadata", {})
        event_type = mem.get("event_type", "")

        if source == "mem0":
            if any(t in tags for t in ["preference", "user_pref"]):
                user_preferences.append(content)
            elif any(t in tags for t in ["decision", "product_decision"]):
                product_decisions.append(content)
            elif any(t in tags for t in ["rule", "domain_rule", "hvac_rule"]):
                domain_rules.append(content)
            else:
                recent_relevant.append(content)
        elif source == "postgres":
            if event_type == "preference":
                user_preferences.append(content)
            elif event_type == "decision":
                product_decisions.append(content)
            elif event_type == "rule":
                domain_rules.append(content)
            elif metadata.get("conversation_state"):
                conversation_state[mem["memory_id"]] = metadata
            else:
                recent_relevant.append(content)
        elif source == "qdrant":
            category = metadata.get("category", "")
            if "rule" in category or "spec" in category:
                domain_rules.append(content)
            else:
                recent_relevant.append(content)

    return {
        "user_preferences": user_preferences,
        "product_decisions": product_decisions,
        "domain_rules": domain_rules,
        "conversation_state": conversation_state,
        "recent_relevant_memories": recent_relevant,
        "source_summary": source_summary,
    }


# =============================================================================
# Memory Writeback
# =============================================================================


def _write_postgres(
    user_id: str,
    conversation_id: str,
    content: str,
    event_type: str = "interaction",
    metadata: Optional[dict] = None,
) -> bool:
    """INSERT into hvac_memory.agent_memory_events. Returns True on success."""
    conn = None
    try:
        conn = pg8000.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO hvac_memory.agent_memory_events
                (user_id, conversation_id, event_type, content, metadata, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                conversation_id,
                event_type,
                content,
                json.dumps(metadata or {}),
                datetime.now(timezone.utc),
            ),
        )
        conn.commit()
        cursor.close()
        logger.info(f"[memory] Postgres writeback ok: conversation={conversation_id}")
        return True
    except Exception as exc:
        logger.warning(f"[memory] Postgres writeback failed: {exc}")
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return False


def _write_mem0(user_id: str, text: str, tags: list[str]) -> bool:
    """Memory.add(). Returns True on success."""
    try:
        client = _get_mem0()
        client.add(
            messages=[{"role": "user", "content": text}],
            user_id=user_id,
            metadata={"tags": tags, "source": "hvac_rag"},
        )
        logger.info(f"[memory] Mem0 writeback ok: tags={tags}")
        return True
    except Exception as exc:
        logger.warning(f"[memory] Mem0 writeback failed: {exc}")
        return False


def memory_writeback(
    user_id: str,
    conversation_id: str,
    query: str,
    answer: str,
    metadata: Optional[dict] = None,
) -> None:
    """
    Writeback após cada resposta MiniMax.
    - Postgres: INSERT interaction (sempre, se não houver segredo)
    - Mem0: só se is_decision ou is_preference
    - Qdrant: NUNCA
    """
    meta = metadata or {}
    combined = f"Q: {query}\nA: {answer}"

    if not _is_secret_free(combined):
        logger.info("[memory] Writeback skipped: secret detected in content")
        return

    summary = _summarize(combined)

    event_type = "interaction"
    if meta.get("is_decision"):
        event_type = "decision"
    elif meta.get("is_preference"):
        event_type = "preference"

    pg_ok = _write_postgres(
        user_id=user_id,
        conversation_id=conversation_id,
        content=summary,
        event_type=event_type,
        metadata={
            "user_id": user_id,
            "domain": "hvac",
            **meta,
        },
    )

    if meta.get("is_decision") or meta.get("is_preference"):
        tags = ["hvac"]
        if meta.get("is_decision"):
            tags.append("decision")
        if meta.get("is_preference"):
            tags.append("preference")
        _write_mem0(user_id, summary, tags)
    elif not pg_ok:
        _write_mem0(user_id, summary, tags=["hvac", "interaction"])


# =============================================================================
# Build Context Pack
# =============================================================================


def build_context_pack(fetch_result: dict) -> str:
    """
    Converte o dict do context_fetch em string para injetar no prompt MiniMax.
    Limite: 2500 tokens — corta do final se exceder.
    """
    parts = []

    prefs = fetch_result.get("user_preferences", [])
    if prefs:
        parts.append(f"- Preferências do usuário: {'; '.join(prefs)}")

    decisions = fetch_result.get("product_decisions", [])
    if decisions:
        parts.append(f"- Decisões de produto: {'; '.join(decisions)}")

    rules = fetch_result.get("domain_rules", [])
    if rules:
        parts.append(f"- Regras do domínio: {'; '.join(rules)}")

    state = fetch_result.get("conversation_state", {})
    if state:
        state_str = json.dumps(state, ensure_ascii=False)
        parts.append(f"- Estado da conversa: {state_str}")

    recent = fetch_result.get("recent_relevant_memories", [])
    if recent:
        parts.append(f"- Memórias recentes: {'; '.join(recent)}")

    if not parts:
        return ""

    header = "## Memória Relevante"
    body = "\n".join(parts)
    raw = f"{header}\n{body}"

    if _estimate_tokens(len(raw)) > MAX_CONTEXT_TOKENS:
        max_chars = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN
        raw = raw[:max_chars]
        last_nl = raw.rfind("\n")
        if last_nl > max_chars * 0.7:
            raw = raw[:last_nl]

    return raw


# =============================================================================
# Health Checks
# =============================================================================


async def check_mem0() -> dict:
    """Test Memory.search() connectivity."""
    try:
        client = _get_mem0()
        client.search(query="healthcheck", top_k=1, filters={"user_id": "healthcheck"})
        return {"service": "mem0", "status": "ok"}
    except Exception as exc:
        return {"service": "mem0", "status": "error", "error": str(exc)}


async def check_postgres() -> dict:
    """Test SELECT 1 against hvac_memory.agent_memory_events."""
    conn = None
    try:
        conn = pg8000.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        return {"service": "postgres", "status": "ok"}
    except Exception as exc:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return {"service": "postgres", "status": "error", "error": str(exc)}


async def check_qdrant() -> dict:
    """Test Qdrant collection info."""
    try:
        client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY if QDRANT_API_KEY else None,
            check_compatibility=False,
        )
        info = client.get_collection(collection_name="hvac_manuals_v1")
        return {"service": "qdrant", "status": "ok", "points": info.points_count}
    except Exception as exc:
        return {"service": "qdrant", "status": "error", "error": str(exc)}


async def memory_health_summary() -> dict:
    """Aggregate health check across all 3 services."""
    mem0, pg, qdrant = await asyncio.gather(
        check_mem0(), check_postgres(), check_qdrant()
    )
    all_ok = all(s["status"] == "ok" for s in [mem0, pg, qdrant])
    return {
        "overall": "ok" if all_ok else "degraded",
        "services": {
            "mem0": mem0,
            "postgres": pg,
            "qdrant": qdrant,
        },
    }
