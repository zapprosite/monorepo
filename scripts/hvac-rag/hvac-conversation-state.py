"""
HVAC Conversation State Manager

Manages multi-turn dialogue state for HVAC troubleshooting conversations.
Tracks brand, family, alarm codes, models, and context across sessions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ConversationState:
    """State for an HVAC conversation session."""

    brand: Optional[str] = None
    family: Optional[str] = None
    alarm_code: Optional[str] = None
    subcode: Optional[str] = None
    outdoor_model: Optional[str] = None
    indoor_model: Optional[str] = None
    last_mode: Optional[str] = None
    evidence_seen: list[str] = field(default_factory=list)


class StateManager:
    """
    Manages conversation state with TTL-based session expiration.

    Attributes:
        _state: Dictionary mapping conversation_id to ConversationState
        _last_access: Dictionary mapping conversation_id to last access timestamp
    """

    # HVAC brand patterns
    BRAND_PATTERNS = {
        "daikin": r"\b(daikin)\b",
        "carrier": r"\b(carrier)\b",
        "midea": r"\b(midea)\b",
        "lg": r"\b(lg)\b",
        "samsung": r"\b(samsung)\b",
        "gree": r"\b(gree)\b",
        "mitsubishi": r"\b(mitsubishi)\b",
        "hitachi": r"\b(hitachi)\b",
        "panasonic": r"\b(panasonic)\b",
        "fujitsu": r"\b(fujitsu)\b",
        "toshiba": r"\b(toshiba)\b",
        "electrolux": r"\b(electrolux)\b",
        "consul": r"\b(consul)\b",
    }

    # HVAC family/unit type patterns
    FAMILY_PATTERNS = {
        "vrv": r"\b(vrv|vr[_-]?v)\b",
        "vrf": r"\b(vrf|vr[_-]?f)\b",
        "split": r"\b(split)\b",
        "hi-wall": r"\b(hi[_-]?wall|hiwall|wall[_-]?mount)\b",
        "cassette": r"\b(cassette)\b",
        "floor": r"\b(floor[_-]?standing|floor[_-]?standing|floor)\b",
        "ceiling": r"\b(ceiling[_-]?cassette|ceiling)\b",
        "concealed": r"\b(concealed|ducted|duct)\b",
        "console": r"\b(console)\b",
        "mixed": r"\b(mixed|multi[_-]?split)\b",
    }

    # Alarm code patterns (E4, U4, E3, etc.)
    ALARM_CODE_PATTERN = r"\b([A-Z][0-9]{1,3})\b"

    # Subcode patterns (01, 001, 02, etc.)
    SUBCODE_PATTERN = r"[/-](0*[0-9]{1,3})(?:\b|$)"

    # Outdoor model patterns (e.g., RXYQ20BRA, RYYQ48BRA)
    OUTDOOR_MODEL_PATTERN = r"\b(R[A-Z]{2,4}[A-Z0-9]{2,12}|[A-Z]{2,4}[0-9]{2,12}[A-Z]{0,4})\b"

    # Indoor model patterns (e.g., FXYC20BRA)
    INDOOR_MODEL_PATTERN = r"\b(F[A-Z]{2,4}[A-Z0-9]{2,12}|[A-Z]{2,4}[0-9]{2,12}[A-Z]{0,4})\b"

    def __init__(self) -> None:
        self._state: dict[str, ConversationState] = {}
        self._last_access: dict[str, float] = {}

    def get_state(self, conversation_id: str) -> ConversationState:
        """
        Retrieve or create state for a conversation.

        Args:
            conversation_id: Unique identifier for the conversation

        Returns:
            ConversationState for the given conversation_id
        """
        now = datetime.now().timestamp()
        if conversation_id not in self._state:
            self._state[conversation_id] = ConversationState()
        self._last_access[conversation_id] = now
        return self._state[conversation_id]

    def update_state(
        self,
        conversation_id: str,
        **kwargs: Optional[str] | list[str],
    ) -> ConversationState:
        """
        Update state fields for a conversation.

        Args:
            conversation_id: Unique identifier for the conversation
            **kwargs: Fields to update (brand, family, alarm_code, subcode,
                     outdoor_model, indoor_model, last_mode, evidence_seen)

        Returns:
            Updated ConversationState
        """
        state = self.get_state(conversation_id)
        now = datetime.now().timestamp()
        self._last_access[conversation_id] = now

        for key, value in kwargs.items():
            if hasattr(state, key):
                if key == "evidence_seen" and isinstance(value, list):
                    # Extend evidence list, avoid duplicates
                    for item in value:
                        if item not in state.evidence_seen:
                            state.evidence_seen.append(item)
                else:
                    setattr(state, key, value)

        return state

    def extract_from_query(self, query: str) -> dict[str, Optional[str] | list[str]]:
        """
        Extract HVAC data from query text.

        Args:
            query: User query text

        Returns:
            Dictionary with extracted fields:
            - brand, family, alarm_code, subcode, outdoor_model, indoor_model
        """
        query_lower = query.lower()
        result: dict[str, Optional[str] | list[str]] = {
            "brand": None,
            "family": None,
            "alarm_code": None,
            "subcode": None,
            "outdoor_model": None,
            "indoor_model": None,
        }

        # Extract brand
        for brand, pattern in self.BRAND_PATTERNS.items():
            if re.search(pattern, query_lower, re.IGNORECASE):
                result["brand"] = brand
                break

        # Extract family
        for family, pattern in self.FAMILY_PATTERNS.items():
            if re.search(pattern, query_lower, re.IGNORECASE):
                result["family"] = family
                break

        # Extract alarm code
        alarm_match = re.search(self.ALARM_CODE_PATTERN, query, re.IGNORECASE)
        if alarm_match:
            result["alarm_code"] = alarm_match.group(1).upper()

        # Extract subcode (must follow alarm code or be standalone)
        subcode_match = re.search(self.SUBCODE_PATTERN, query)
        if subcode_match:
            result["subcode"] = subcode_match.group(1)

        # Extract outdoor model (typically starts with R)
        outdoor_matches = re.findall(self.OUTDOOR_MODEL_PATTERN, query, re.IGNORECASE)
        for match in outdoor_matches:
            # Filter out common English words that match the pattern
            if not re.match(r"^(the|and|for|are|but|not|you|all|can|her|was|one|our|out)$", match, re.IGNORECASE):
                result["outdoor_model"] = match.upper()
                break

        # Extract indoor model (typically starts with F)
        indoor_matches = re.findall(self.INDOOR_MODEL_PATTERN, query, re.IGNORECASE)
        for match in indoor_matches:
            if not re.match(r"^(the|and|for|are|but|not|you|all|can|her|was|one|our|out|fix|box|tax|run|fan|air|heat|cool|mode)$", match, re.IGNORECASE):
                result["indoor_model"] = match.upper()
                break

        return result

    def expand_short_query(
        self,
        query: str,
        state: ConversationState,
    ) -> str:
        """
        Expand a short query using conversation state.

        If the query is too short or lacks HVAC context,
        inject relevant information from the state.

        Args:
            query: User query text
            state: Current conversation state

        Returns:
            Expanded query string with context from state
        """
        # Define what constitutes a "short" query
        MIN_QUERY_WORDS = 5

        words = query.split()
        is_short = len(words) < MIN_QUERY_WORDS
        has_hvac_context = bool(
            state.brand
            or state.family
            or state.alarm_code
            or state.outdoor_model
        )

        if not is_short or not has_hvac_context:
            return query

        # Build context string from state
        context_parts = []

        if state.brand:
            context_parts.append(f"brand: {state.brand}")
        if state.family:
            context_parts.append(f"system type: {state.family}")
        if state.alarm_code:
            code = state.alarm_code
            if state.subcode:
                code = f"{code}/{state.subcode}"
            context_parts.append(f"alarm code: {code}")
        if state.outdoor_model:
            context_parts.append(f"outdoor unit: {state.outdoor_model}")
        if state.indoor_model:
            context_parts.append(f"indoor unit: {state.indoor_model}")
        if state.last_mode:
            context_parts.append(f"last mode: {state.last_mode}")

        if context_parts:
            context_str = " | ".join(context_parts)
            return f"{query} [Context: {context_str}]"

        return query

    def cleanup_ttl(self, ttl_seconds: float = 1800) -> int:
        """
        Remove expired sessions based on TTL.

        Args:
            ttl_seconds: Time-to-live in seconds (default: 1800 = 30 minutes)

        Returns:
            Number of sessions removed
        """
        now = datetime.now().timestamp()
        expired_ids = [
            cid
            for cid, last_access in self._last_access.items()
            if now - last_access > ttl_seconds
        ]

        for cid in expired_ids:
            del self._state[cid]
            del self._last_access[cid]

        return len(expired_ids)


# CLI testing
if __name__ == "__main__":
    import sys

    print("=== HVAC Conversation State Manager - CLI Test ===\n")

    manager = StateManager()

    # Test conversation ID
    conv_id = "test-conversation-001"

    # Simulate a conversation
    print("1. Creating initial state...")
    state = manager.get_state(conv_id)
    print(f"   Initial state: brand={state.brand}, alarm_code={state.alarm_code}")

    print("\n2. Simulating query: 'Daikin VRV system with E4 alarm code 01 on RXYQ20BRA outdoor unit'")
    extracted = manager.extract_from_query(
        "Daikin VRV system with E4 alarm code 01 on RXYQ20BRA outdoor unit"
    )
    print(f"   Extracted: {extracted}")

    # Update state with extracted data
    manager.update_state(conv_id, **extracted)
    state = manager.get_state(conv_id)
    print(f"   Updated state: brand={state.brand}, family={state.family}, "
          f"alarm_code={state.alarm_code}, subcode={state.subcode}, "
          f"outdoor_model={state.outdoor_model}")

    print("\n3. Testing short query expansion...")
    short_query = "what does E4 mean?"
    expanded = manager.expand_short_query(short_query, state)
    print(f"   Original: '{short_query}'")
    print(f"   Expanded: '{expanded}'")

    print("\n4. Testing long query (no expansion)...")
    long_query = "Can you explain what the E4 alarm code means in detail?"
    expanded_long = manager.expand_short_query(long_query, state)
    print(f"   Original: '{long_query}'")
    print(f"   Expanded: '{expanded_long}'")

    print("\n5. Testing cleanup (simulating expired sessions)...")
    # Add some fake expired sessions
    manager._last_access["expired-1"] = datetime.now().timestamp() - 3600
    manager._state["expired-1"] = ConversationState(brand="carrier")
    manager._last_access["expired-2"] = datetime.now().timestamp() - 2000
    manager._state["expired-2"] = ConversationState(brand="lg")

    print(f"   Sessions before cleanup: {len(manager._state)}")
    removed = manager.cleanup_ttl(ttl_seconds=1800)
    print(f"   Sessions removed: {removed}")
    print(f"   Sessions after cleanup: {len(manager._state)}")

    print("\n6. Testing additional extraction patterns...")
    test_queries = [
        "Carrier split system error U4/02",
        "Midea VRF E3 alarm on indoor unit FXYC20BRA",
        "Samsung cassette showing E1 subcode 03",
        "Gree mini split with no alarm just monitoring",
        "LG VRV outdoor RYYQ48BRA indoor FXYC20BRA error E5/001",
    ]

    for q in test_queries:
        extracted = manager.extract_from_query(q)
        print(f"   Query: '{q}'")
        print(f"   -> {extracted}\n")

    print("=== All tests completed ===")
    sys.exit(0)
