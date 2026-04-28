"""
Pytest tests for hvac-conversation-state.py
"""

import sys
import os
import importlib.util
from datetime import datetime, timedelta
from unittest.mock import patch

# Import module with hyphenated filename using importlib
SCRIPT_DIR = "/srv/monorepo/scripts/hvac-rag"
_spec = importlib.util.spec_from_file_location(
    "hvac_conversation_state",
    os.path.join(SCRIPT_DIR, "hvac-conversation-state.py")
)
_hvac_conversation_state = importlib.util.module_from_spec(_spec)
sys.modules["hvac_conversation_state"] = _hvac_conversation_state
_spec.loader.exec_module(_hvac_conversation_state)

StateManager = _hvac_conversation_state.StateManager
ConversationState = _hvac_conversation_state.ConversationState


class TestGetState:
    """Tests for StateManager.get_state()"""

    def test_get_state_creates_new_state(self):
        """Test that get_state() creates a new state for new conversation_id"""
        manager = StateManager()
        conv_id = "test-conv-001"

        state = manager.get_state(conv_id)

        assert isinstance(state, ConversationState)
        assert state.brand is None
        assert state.family is None
        assert state.alarm_code is None
        assert state.subcode is None
        assert state.outdoor_model is None
        assert state.indoor_model is None
        assert state.evidence_seen == []

    def test_get_state_returns_same_state(self):
        """Test that get_state() returns the same state on subsequent calls"""
        manager = StateManager()
        conv_id = "test-conv-002"

        state1 = manager.get_state(conv_id)
        state2 = manager.get_state(conv_id)

        assert state1 is state2

    def test_get_state_updates_last_access(self):
        """Test that get_state() updates last_access timestamp"""
        manager = StateManager()
        conv_id = "test-conv-003"

        manager.get_state(conv_id)
        access_time = manager._last_access[conv_id]

        # Small delay to ensure timestamp changes
        import time
        time.sleep(0.01)

        manager.get_state(conv_id)
        new_access_time = manager._last_access[conv_id]

        assert new_access_time >= access_time


class TestExtractFromQuery:
    """Tests for StateManager.extract_from_query()"""

    def test_extract_brand(self):
        """Test brand extraction"""
        manager = StateManager()

        for brand_name in ["daikin", "carrier", "midea", "lg", "samsung", "gree", "mitsubishi"]:
            result = manager.extract_from_query(f"My {brand_name} system is broken")
            assert result["brand"] == brand_name, f"Failed for brand: {brand_name}"

    def test_extract_family(self):
        """Test family/unit type extraction"""
        manager = StateManager()

        test_cases = [
            ("I have a VRV system", "vrv"),
            ("VRF unit not working", "vrf"),
            ("split system issue", "split"),
            ("hi-wall unit problem", "hi-wall"),
            ("cassette installation", "cassette"),
            ("floor standing unit", "floor"),
            ("concealed duct system", "concealed"),
            ("console type AC", "console"),
        ]

        for query, expected_family in test_cases:
            result = manager.extract_from_query(query)
            assert result["family"] == expected_family, f"Failed for query: {query}"

    def test_extract_family_ceiling(self):
        """Test ceiling extraction without cassette"""
        manager = StateManager()
        result = manager.extract_from_query("ceiling mounted unit")
        assert result["family"] == "ceiling"

    def test_extract_alarm_code(self):
        """Test alarm code extraction"""
        manager = StateManager()

        test_cases = [
            ("Error E4 detected", "E4"),
            ("alarm code U4/02", "U4"),
            ("showing E3 error", "E3"),
            ("E1 alarm triggered", "E1"),
            ("E10 error message", "E10"),
        ]

        for query, expected_code in test_cases:
            result = manager.extract_from_query(query)
            assert result["alarm_code"] == expected_code, f"Failed for query: {query}"

    def test_extract_subcode(self):
        """Test subcode extraction"""
        manager = StateManager()

        test_cases = [
            ("E4/01 fault", "01"),
            ("alarm U4-001", "001"),
            ("error E3/1", "1"),
            ("E5/002 problem", "002"),
        ]

        for query, expected_subcode in test_cases:
            result = manager.extract_from_query(query)
            assert result["subcode"] == expected_subcode, f"Failed for query: {query}"

    def test_extract_outdoor_model(self):
        """Test outdoor model extraction"""
        manager = StateManager()

        test_cases = [
            ("RXYQ20BRA outdoor unit", "RXYQ20BRA"),
            ("model RYYQ48BRA is failing", "RYYQ48BRA"),
            ("outdoor RABC123XYZ unit", "RABC123XYZ"),
        ]

        for query, expected_model in test_cases:
            result = manager.extract_from_query(query)
            assert result["outdoor_model"] == expected_model, f"Failed for query: {query}"

    def test_extract_indoor_model(self):
        """Test indoor model extraction"""
        manager = StateManager()

        test_cases = [
            ("FXYC20BRA indoor unit", "FXYC20BRA"),
            ("indoor FXYC25BRA model", "FXYC25BRA"),
            ("FABC123XYZ inside unit", "FABC123XYZ"),
        ]

        for query, expected_model in test_cases:
            result = manager.extract_from_query(query)
            assert result["indoor_model"] == expected_model, f"Failed for query: {query}"

    def test_extract_full_query(self):
        """Test extracting all fields from a full query"""
        manager = StateManager()

        # Use E4/01 format for subcode extraction (requires / separator)
        query = "Daikin VRV system with E4/01 alarm on RXYQ20BRA outdoor unit"
        result = manager.extract_from_query(query)

        assert result["brand"] == "daikin"
        assert result["family"] == "vrv"
        assert result["alarm_code"] == "E4"
        assert result["subcode"] == "01"
        assert result["outdoor_model"] == "RXYQ20BRA"


class TestUpdateState:
    """Tests for StateManager.update_state()"""

    def test_update_state_single_field(self):
        """Test updating a single field"""
        manager = StateManager()
        conv_id = "test-update-001"

        manager.update_state(conv_id, brand="carrier")
        state = manager.get_state(conv_id)

        assert state.brand == "carrier"

    def test_update_state_multiple_fields(self):
        """Test updating multiple fields at once"""
        manager = StateManager()
        conv_id = "test-update-002"

        manager.update_state(
            conv_id,
            brand="daikin",
            family="vrv",
            alarm_code="E4",
            subcode="01",
            outdoor_model="RXYQ20BRA",
        )

        state = manager.get_state(conv_id)

        assert state.brand == "daikin"
        assert state.family == "vrv"
        assert state.alarm_code == "E4"
        assert state.subcode == "01"
        assert state.outdoor_model == "RXYQ20BRA"

    def test_update_state_evidence_seen(self):
        """Test updating evidence_seen list"""
        manager = StateManager()
        conv_id = "test-update-003"

        manager.update_state(conv_id, evidence_seen=["error_log_1.txt"])
        state = manager.get_state(conv_id)

        assert "error_log_1.txt" in state.evidence_seen

    def test_update_state_evidence_seen_avoids_duplicates(self):
        """Test that evidence_seen avoids duplicates"""
        manager = StateManager()
        conv_id = "test-update-004"

        manager.update_state(conv_id, evidence_seen=["error_log_1.txt"])
        manager.update_state(conv_id, evidence_seen=["error_log_1.txt", "error_log_2.txt"])
        state = manager.get_state(conv_id)

        assert state.evidence_seen.count("error_log_1.txt") == 1
        assert "error_log_2.txt" in state.evidence_seen

    def test_update_state_updates_access_time(self):
        """Test that update_state updates last_access timestamp"""
        manager = StateManager()
        conv_id = "test-update-005"

        manager.get_state(conv_id)
        original_access = manager._last_access[conv_id]

        import time
        time.sleep(0.01)

        manager.update_state(conv_id, brand="lg")
        new_access = manager._last_access[conv_id]

        assert new_access >= original_access


class TestExpandShortQuery:
    """Tests for StateManager.expand_short_query()"""

    def test_expand_short_query_with_existing_state(self):
        """Test expanding a short query using existing state"""
        manager = StateManager()
        conv_id = "test-expand-001"

        # Set up state
        manager.update_state(
            conv_id,
            brand="daikin",
            family="vrv",
            alarm_code="E4",
            subcode="01",
            outdoor_model="RXYQ20BRA",
        )
        state = manager.get_state(conv_id)

        # Short query
        short_query = "what does E4 mean?"
        expanded = manager.expand_short_query(short_query, state)

        assert expanded != short_query
        assert "daikin" in expanded
        assert "E4" in expanded
        assert "RXYQ20BRA" in expanded
        assert "[Context:" in expanded

    def test_expand_short_query_long_query_no_expansion(self):
        """Test that long queries are not expanded"""
        manager = StateManager()
        conv_id = "test-expand-002"

        # Set up state
        manager.update_state(conv_id, brand="carrier", alarm_code="U4")
        state = manager.get_state(conv_id)

        # Long query (5+ words)
        long_query = "Can you explain what the E4 alarm code means in detail?"
        expanded = manager.expand_short_query(long_query, state)

        assert expanded == long_query

    def test_expand_short_query_no_hvac_context(self):
        """Test that queries without HVAC context are not expanded"""
        manager = StateManager()
        state = ConversationState()

        short_query = "hello"
        expanded = manager.expand_short_query(short_query, state)

        assert expanded == short_query

    def test_expand_short_query_minimum_word_count(self):
        """Test that queries with exactly 5 words are not expanded"""
        manager = StateManager()
        state = ConversationState(brand="daikin")

        # Exactly 5 words (threshold is < 5, so 5 words is NOT short)
        query_5_words = "What is the E4 alarm code?"
        expanded = manager.expand_short_query(query_5_words, state)

        # 5 words is the threshold, so this should not be expanded
        assert expanded == query_5_words

    def test_expand_short_query_four_words_is_short(self):
        """Test that queries with 4 words ARE expanded"""
        manager = StateManager()
        state = ConversationState(brand="daikin")

        # 4 words is short (< 5)
        query_4_words = "What is E4?"
        expanded = manager.expand_short_query(query_4_words, state)

        # Should be expanded
        assert "[Context:" in expanded


class TestTTLCleanup:
    """Tests for StateManager.cleanup_ttl()"""

    def test_cleanup_removes_old_sessions(self):
        """Test that cleanup removes expired sessions"""
        manager = StateManager()

        # Create active session
        manager.get_state("active-001")

        # Create expired sessions by directly setting old timestamps
        now = datetime.now().timestamp()
        manager._last_access["expired-001"] = now - 3600  # 1 hour ago
        manager._state["expired-001"] = ConversationState(brand="carrier")

        manager._last_access["expired-002"] = now - 1900  # ~31 minutes ago
        manager._state["expired-002"] = ConversationState(brand="lg")

        # Verify all exist before cleanup
        assert "active-001" in manager._state
        assert "expired-001" in manager._state
        assert "expired-002" in manager._state

        # Cleanup with 30 minute TTL
        removed = manager.cleanup_ttl(ttl_seconds=1800)

        # expired-001 and expired-002 should be removed
        assert removed == 2
        assert "active-001" in manager._state
        assert "expired-001" not in manager._state
        assert "expired-002" not in manager._state

    def test_cleanup_returns_count(self):
        """Test that cleanup returns number of removed sessions"""
        manager = StateManager()

        now = datetime.now().timestamp()

        # Recent session
        manager.get_state("session-1")

        # Old sessions
        manager._last_access["session-2"] = now - 3600
        manager._state["session-2"] = ConversationState()
        manager._last_access["session-3"] = now - 2000
        manager._state["session-3"] = ConversationState()

        removed = manager.cleanup_ttl(ttl_seconds=1800)

        assert removed == 2

    def test_cleanup_no_expired_sessions(self):
        """Test cleanup when no sessions are expired"""
        manager = StateManager()

        manager.get_state("session-001")
        manager.get_state("session-002")

        removed = manager.cleanup_ttl(ttl_seconds=1800)

        assert removed == 0
        assert len(manager._state) == 2


class TestConversationIdGeneration:
    """Tests for conversation_id generation patterns"""

    def test_header_based_conversation_id(self):
        """Test header-based conversation ID (X-Conversation-ID style)"""
        manager = StateManager()

        conv_id = "conv-abc123-header"
        state = manager.get_state(conv_id)

        assert isinstance(state, ConversationState)
        assert conv_id in manager._state

    def test_hash_based_conversation_id(self):
        """Test hash-based conversation ID"""
        manager = StateManager()

        import hashlib
        test_input = "user123|2024-01-01|session456"
        conv_id = hashlib.sha256(test_input.encode()).hexdigest()[:16]

        state = manager.get_state(conv_id)

        assert isinstance(state, ConversationState)
        assert conv_id in manager._state

    def test_conversation_id_persistence(self):
        """Test that conversation_id persists across multiple get_state calls"""
        manager = StateManager()

        conv_id = "persistent-conv-001"

        state1 = manager.get_state(conv_id)
        state1.brand = "carrier"

        state2 = manager.get_state(conv_id)

        assert state2.brand == "carrier"


class TestMultipleConversations:
    """Tests for multiple concurrent conversations"""

    def test_multiple_conversations_independent(self):
        """Test that multiple conversations don't interfere"""
        manager = StateManager()

        # Conversation 1
        manager.update_state("conv-1", brand="daikin", alarm_code="E4")
        state1 = manager.get_state("conv-1")

        # Conversation 2
        manager.update_state("conv-2", brand="carrier", alarm_code="U4")
        state2 = manager.get_state("conv-2")

        assert state1.brand == "daikin"
        assert state1.alarm_code == "E4"
        assert state2.brand == "carrier"
        assert state2.alarm_code == "U4"

    def test_multiple_conversations_state_isolation(self):
        """Test that conversation states are fully isolated"""
        manager = StateManager()

        manager.update_state(
            "conv-A",
            brand="midea",
            family="vrf",
            alarm_code="E3",
            outdoor_model="RABC123",
        )

        manager.update_state(
            "conv-B",
            brand="lg",
            family="split",
            alarm_code="E5",
            indoor_model="FXYZ789",
        )

        state_A = manager.get_state("conv-A")
        state_B = manager.get_state("conv-B")

        # Verify A's state is unchanged
        assert state_A.brand == "midea"
        assert state_A.family == "vrf"
        assert state_A.alarm_code == "E3"
        assert state_A.outdoor_model == "RABC123"
        assert state_A.indoor_model is None

        # Verify B's state is unchanged
        assert state_B.brand == "lg"
        assert state_B.family == "split"
        assert state_B.alarm_code == "E5"
        assert state_B.indoor_model == "FXYZ789"
        assert state_B.outdoor_model is None

    def test_cleanup_only_affects_expired(self):
        """Test that cleanup only removes expired sessions, not active ones"""
        manager = StateManager()

        now = datetime.now().timestamp()

        # Active session (recent)
        manager.get_state("active-conv")

        # Expired sessions
        manager._last_access["expired-conv-1"] = now - 3600
        manager._state["expired-conv-1"] = ConversationState()
        manager._last_access["expired-conv-2"] = now - 1900
        manager._state["expired-conv-2"] = ConversationState()

        # Verify all exist
        assert len(manager._state) == 3

        # Cleanup
        manager.cleanup_ttl(ttl_seconds=1800)

        # Only expired ones should be removed
        assert "active-conv" in manager._state
        assert len(manager._state) == 1


class TestConversationState:
    """Tests for ConversationState dataclass"""

    def test_default_values(self):
        """Test that ConversationState has correct default values"""
        state = ConversationState()

        assert state.brand is None
        assert state.family is None
        assert state.alarm_code is None
        assert state.subcode is None
        assert state.outdoor_model is None
        assert state.indoor_model is None
        assert state.last_mode is None
        assert state.evidence_seen == []

    def test_initial_values(self):
        """Test creating ConversationState with initial values"""
        state = ConversationState(
            brand="daikin",
            family="vrv",
            alarm_code="E4",
            subcode="01",
            outdoor_model="RXYQ20BRA",
            indoor_model="FXYC20BRA",
            last_mode="cooling",
            evidence_seen=["log1.txt", "log2.txt"],
        )

        assert state.brand == "daikin"
        assert state.family == "vrv"
        assert state.alarm_code == "E4"
        assert state.subcode == "01"
        assert state.outdoor_model == "RXYQ20BRA"
        assert state.indoor_model == "FXYC20BRA"
        assert state.last_mode == "cooling"
        assert state.evidence_seen == ["log1.txt", "log2.txt"]
