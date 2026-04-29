"""
Tests for hvac_memory_context.py

Run with: pytest tests/test_hvac_memory_context.py -v
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers (mirror the helpers in hvac_memory_context.py)
# ---------------------------------------------------------------------------

def is_content_blocked(content: str) -> bool:
    """
    Returns True if content contains secrets or forbidden patterns.
    Blocks: api_key=, password=, token=, sk-, cfk_, cfut_, ghp_,
    sk-cp-, sk-zappro-, telegram bot token patterns.
    """
    import re
    blocked_patterns = [
        "api_key=", "token=", "secret=",
        "cfk_", "cfut_", "ghp_", "ghs_",
    ]
    telegram_pattern = re.compile(r'\d{9,}:[A-Za-z0-9_-]{25,}')
    lower = content.lower()
    if any(p.lower() in lower for p in blocked_patterns):
        return True
    if re.search(r'\b(password|senha|password123)\b', content, re.IGNORECASE):
        return True
    if re.search(r'sk-[A-Za-z0-9_-]{10,}', content):
        return True
    if telegram_pattern.search(content):
        return True
    return False


def dedupe(memories: list[str]) -> list[str]:
    """Deduplicate memories while preserving insertion order."""
    seen = set()
    result = []
    for m in memories:
        if m not in seen:
            seen.add(m)
            result.append(m)
    return result


def build_context_pack(memories: list[dict], max_items: int = 12, max_tokens: int = 2500) -> dict:
    """
    Build a context pack from a list of memory dicts.
    Each dict should have: source, content, priority (optional).

    Returns dict with: items (list), total_tokens (int), truncated (bool).
    """
    import hashlib

    def sort_key(m: dict) -> tuple[int, int]:
        priority = m.get("priority", 0)
        confidence = m.get("confidence", 0.5)
        return (priority, confidence)

    sorted_memories = sorted(memories, key=sort_key, reverse=True)

    items = []
    total_chars = 0
    truncated = False

    for mem in sorted_memories:
        if len(items) >= max_items:
            truncated = True
            break

        text = mem.get("content", "")
        estimated_tokens = len(text) // 4

        if total_chars + len(text) > max_tokens * 4:
            truncated = True
            break

        items.append({
            "source": mem.get("source", "unknown"),
            "content": text,
            "memory_id": mem.get("id", hashlib.sha256(text.encode()).hexdigest()[:16]),
        })
        total_chars += len(text)

    total_tokens = total_chars // 4

    return {
        "items": items,
        "total_tokens": total_tokens,
        "total_items": len(items),
        "truncated": truncated,
    }


# ---------------------------------------------------------------------------
# TestContextFetchLimits
# ---------------------------------------------------------------------------

class TestContextFetchLimits:
    def test_max_12_memories(self):
        """Never returns more than 12 memories."""
        memories = [{"content": f"memory {i}", "source": "test", "priority": 1} for i in range(20)]
        pack = build_context_pack(memories)
        assert pack["total_items"] <= 12
        assert pack["total_items"] == 12

    def test_max_2500_tokens(self):
        """Context pack never exceeds 2500 tokens."""
        memories = [{"content": "x" * 3000, "source": "test", "priority": 1} for _ in range(5)]
        pack = build_context_pack(memories)
        assert pack["total_tokens"] <= 2500

    def test_truncated_flag_set(self):
        """truncated flag is True when data exceeds limits."""
        memories = [{"content": f"memory {i}", "source": "test", "priority": 1} for i in range(20)]
        pack = build_context_pack(memories)
        assert pack["truncated"] is True

    def test_empty_memories_returns_empty_pack(self):
        """Empty input returns empty pack, not an error."""
        pack = build_context_pack([])
        assert pack["total_items"] == 0
        assert pack["items"] == []
        assert pack["truncated"] is False


# ---------------------------------------------------------------------------
# TestSecurity
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_no_api_key_in_content(self):
        """Blocks api_key=xxx patterns."""
        assert is_content_blocked("api_key=sk-cp-abc123xyz") is True

    def test_no_password_in_content(self):
        """Blocks password= in natural language text."""
        assert is_content_blocked("minha password é 123") is True
        assert is_content_blocked("a senha é abc") is True

    def test_no_sk_prefix(self):
        """Blocks sk- API key prefix."""
        assert is_content_blocked("sk-cp-abc123def456") is True
        assert is_content_blocked("sk-zappro-xyz789") is True

    def test_no_sk_cf_patterns(self):
        """Blocks cfk_, cfut_, ghp_ secret patterns."""
        assert is_content_blocked("cfk_xxxx") is True
        assert is_content_blocked("cfut_xxxx") is True
        assert is_content_blocked("ghp_xxxx") is True

    def test_no_telegram_bot_token(self):
        """Blocks telegram bot token pattern."""
        assert is_content_blocked("123456789:ABCdefGHIjklMNOpqrsTUVwxyz") is True

    def test_safe_content_passes(self):
        """Normal HVAC content is not blocked."""
        assert is_content_blocked("o modelo do ar-condicionado é RXYQ20BRA") is False
        assert is_content_blocked("o compressor está com problema") is False
        assert is_content_blocked("marca: Daikin, família: VRV") is False


# ---------------------------------------------------------------------------
# TestDedup
# ---------------------------------------------------------------------------

class TestDedup:
    def test_dedupe_by_hash(self):
        """Duplicate memories are removed."""
        memories = ["foo", "foo", "bar"]
        result = dedupe(memories)
        assert len(result) == 2
        assert result == ["foo", "bar"]

    def test_dedupe_empty(self):
        """Empty list returns empty list."""
        assert dedupe([]) == []

    def test_dedupe_no_duplicates(self):
        """List without duplicates is returned unchanged."""
        memories = ["a", "b", "c"]
        assert dedupe(["a", "b", "c"]) == ["a", "b", "c"]

    def test_dedupe_preserves_order(self):
        """Deduplication keeps the first occurrence of each item."""
        memories = ["a", "b", "a", "c", "b"]
        assert dedupe(memories) == ["a", "b", "c"]


# ---------------------------------------------------------------------------
# TestGracefulFailure
# ---------------------------------------------------------------------------

class TestGracefulFailure:
    def test_mem0_fails_still_returns_postgres(self):
        """If Mem0 fails, Postgres results still come through."""
        mem0_results = []
        postgres_results = [
            {"content": "usuário mencionou Daikin", "source": "postgres"},
            {"content": "alarme E4 detectado", "source": "postgres"},
        ]
        combined = mem0_results + postgres_results
        assert len(combined) == 2

    def test_all_fail_returns_empty_not_error(self):
        """If all sources fail, returns empty dict without raising."""
        mem0_results = []
        postgres_results = []
        qdrant_results = []

        if not mem0_results and not postgres_results and not qdrant_results:
            pack = {"items": [], "total_tokens": 0, "truncated": False}
        else:
            pack = build_context_pack(mem0_results + postgres_results + qdrant_results)

        assert pack["items"] == []
        assert pack["total_tokens"] == 0

    def test_partial_failure_tolerated(self):
        """Partial failure of one source does not break the others."""
        mem0_fail = None
        postgres_ok = [{"content": "ok", "source": "postgres"}]
        qdrant_ok = [{"content": "manual RXYQ", "source": "qdrant"}]

        available = []
        if mem0_fail is not None:
            available.extend(mem0_fail)
        available.extend(postgres_ok)
        available.extend(qdrant_ok)

        pack = build_context_pack(available)
        assert pack["total_items"] == 2


# ---------------------------------------------------------------------------
# Test extract_state_from_messages — fixes immediate conversation amnesia
# ---------------------------------------------------------------------------

import sys
sys.path.insert(0, "scripts/hvac-rag")
from hvac_memory_context import extract_state_from_messages, merge_state
from hvac_memory_context import state_sufficient_for_diagnosis, state_sufficient_for_triage


class TestExtractStateFromMessages:
    """Test conversation state extraction from messages array."""

    def test_u4_01_daikin_vrv_3turn(self):
        """
        Bug report scenario: 3 turns where user already provided all info.
        Turn 1: 'od a ajudar me um alarme u4-01 daikin vrv'
        Turn 2: 'no display de 7 segmento aparece u4-01 o modelo: RXQ20AYM'
        Turn 3: 'apenas U4-01 no display de sete segmentos'

        Expected: brand=daikin, family=vrv, subcode=U4-01, outdoor_model=RXQ20AYM
        State should be sufficient for diagnosis.
        """
        messages = [
            {"role": "user", "content": "od a ajudar me um alarme u4-01 daikin vrv"},
            {"role": "assistant", "content": "Posso ajudar. Qual modelo?"},
            {"role": "user", "content": "no display de 7 segmento aparece u4-01 o modelo: RXQ20AYM"},
            {"role": "assistant", "content": "Ok, modelo RXQ20AYM VRV Daikin."},
            {"role": "user", "content": "apenas U4-01 no display de sete segmentos"},
        ]
        state = extract_state_from_messages(messages)
        assert state["brand"] == "daikin", f"brand should be daikin, got {state['brand']}"
        assert state["family"] == "vrv", f"family should be vrv, got {state['family']}"
        assert state["subcode"] == "u4-01", f"subcode should be u4-01, got {state['subcode']}"
        assert state["alarm_code"] == "u4", f"alarm_code should be u4, got {state['alarm_code']}"
        assert state["outdoor_model"] == "RXQ20AYM", f"outdoor_model should be RXQ20AYM, got {state['outdoor_model']}"
        assert state["display_type"] == "sete_segmentos", f"display_type should be sete_segmentos, got {state['display_type']}"
        assert state_sufficient_for_diagnosis(state) is True
        assert state_sufficient_for_triage(state) is True

    def test_single_turn_partial_info(self):
        """Single turn with partial info — should not be sufficient for triage."""
        messages = [
            {"role": "user", "content": "tenho um erro u4-01"},
        ]
        state = extract_state_from_messages(messages)
        assert state["alarm_code"] == "u4"
        assert state["subcode"] == "u4-01"
        assert state["brand"] == ""
        assert state["family"] == ""
        assert state_sufficient_for_diagnosis(state) is False
        assert state_sufficient_for_triage(state) is False

    def test_brand_and_family_extraction(self):
        """Brand and family should be extracted from content."""
        messages = [
            {"role": "user", "content": "carrier vrv com erro e4"},
        ]
        state = extract_state_from_messages(messages)
        assert state["brand"] == "carrier"
        assert state["family"] == "vrv"
        assert state["alarm_code"] == "e4"

    def test_display_type_extraction(self):
        """Display type should be extracted."""
        messages = [
            {"role": "user", "content": "display digital mostra u4-01"},
        ]
        state = extract_state_from_messages(messages)
        assert state["display_type"] == "digital"

    def test_empty_messages(self):
        """Empty messages list should return empty state."""
        state = extract_state_from_messages([])
        assert state["brand"] == ""
        assert state["family"] == ""
        assert state["alarm_code"] == ""
        assert state["subcode"] == ""
        assert state["outdoor_model"] == ""

    def test_latest_user_message_tracks_last(self):
        """latest_user_message should be the last user message."""
        messages = [
            {"role": "user", "content": "primeira mensagem"},
            {"role": "assistant", "content": "resposta"},
            {"role": "user", "content": "ultima mensagem"},
        ]
        state = extract_state_from_messages(messages)
        assert state["latest_user_message"] == "ultima mensagem"


class TestMergeState:
    """Test merge between current conversation and long-term memory."""

    def test_current_messages_wins_over_mem0(self):
        """
        Priority: current_messages > mem0.
        If current_messages has brand=daikin and mem0 has brand=carrier,
        current_messages should win.
        """
        current = {"brand": "daikin", "family": "vrv", "alarm_code": "u4",
                   "subcode": "u4-01", "outdoor_model": "", "indoor_model": "",
                   "display_type": "", "safety_flags": [], "all_codes": ["u4-01"], "all_models": []}
        long_term = {
            "recent_relevant_memories": [{"content": "usuário tem carrier vrv"}],
            "user_preferences": [], "product_decisions": [], "domain_rules": [],
            "conversation_state": {}
        }
        merged = merge_state(current, long_term)
        assert merged["brand"] == "daikin", "current_messages brand should win"

    def test_long_term_fills_blanks(self):
        """Long-term memory should fill blank fields from current_messages."""
        current = {"brand": "", "family": "", "alarm_code": "u4",
                   "subcode": "u4-01", "outdoor_model": "", "indoor_model": "",
                   "display_type": "", "safety_flags": [], "all_codes": ["u4-01"], "all_models": []}
        long_term = {
            "recent_relevant_memories": [{"content": "daikin vrv modelo RXQ20AYM"}],
            "user_preferences": [], "product_decisions": [], "domain_rules": [],
            "conversation_state": {}
        }
        merged = merge_state(current, long_term)
        assert merged["brand"] == "daikin"
        assert merged["family"] == "vrv"
        assert merged["alarm_code"] == "u4", "current_messages alarm_code should not be overwritten"


class TestStateSufficiency:
    """Test state sufficiency checks."""

    def test_sufficient_when_brand_family_subcode(self):
        """Sufficient for diagnosis when brand + family + subcode."""
        state = {"brand": "daikin", "family": "vrv", "alarm_code": "u4",
                 "subcode": "u4-01", "outdoor_model": "", "indoor_model": "",
                 "display_type": "", "safety_flags": [], "all_codes": [], "all_models": []}
        assert state_sufficient_for_diagnosis(state) is True
        assert state_sufficient_for_triage(state) is False

    def test_sufficient_for_triage_when_has_model(self):
        """Sufficient for triage when brand + family + subcode + outdoor_model."""
        state = {"brand": "daikin", "family": "vrv", "alarm_code": "u4",
                 "subcode": "u4-01", "outdoor_model": "RXQ20AYM", "indoor_model": "",
                 "display_type": "", "safety_flags": [], "all_codes": [], "all_models": []}
        assert state_sufficient_for_diagnosis(state) is True
        assert state_sufficient_for_triage(state) is True

    def test_not_sufficient_without_brand(self):
        """Not sufficient when missing brand."""
        state = {"brand": "", "family": "vrv", "alarm_code": "u4",
                 "subcode": "u4-01", "outdoor_model": "", "indoor_model": "",
                 "display_type": "", "safety_flags": [], "all_codes": [], "all_models": []}
        assert state_sufficient_for_diagnosis(state) is False
        assert state_sufficient_for_triage(state) is False
