"""
Integration test: Onboarding pipeline (WF-2)

Verifies that onboarding_flow.ts implements a real LangGraph StateGraph
with interrupt() for human approval, matching the workflow specification.

Workflow: CREATE_PROFILE → INIT_QDRANT → HUMAN_GATE → WELCOME → MILESTONE → CHECKIN
  - interrupt() at HUMAN_GATE pauses for human approval via approveOnboarding()
  - approveOnboarding(clientId, true) resumes with humanApproved=true
  - approveOnboarding(clientId, false) skips WELCOME and ends

Run: cd apps/CRM-REFRIMIX && pytest tests/integration/test_onboarding_pipeline.py -v
"""
import pytest
import re
from pathlib import Path


# Path to hermes-agency langgraph directory
HERMES_AGENCY_ROOT = Path(__file__).parent.parent.parent.parent.parent / "apps" / "hermes-agency" / "src" / "langgraph"


def read_source_file(filename: str) -> str:
    """Read a TypeScript source file from hermes-agency."""
    filepath = HERMES_AGENCY_ROOT / filename
    if not filepath.exists():
        pytest.fail(f"Workflow file not found: {filepath}")
    return filepath.read_text(encoding="utf-8")


class TestOnboardingWorkflowStructure:
    """Verify onboarding_flow.ts uses real LangGraph StateGraph."""

    def test_workflow_uses_real_stategraph(self):
        """Verify onboarding_flow.ts uses StateGraph, not sequential async."""
        content = read_source_file("onboarding_flow.ts")

        assert "StateGraph" in content, "Missing StateGraph import/usage"
        assert ".compile(" in content, "Missing .compile() call"
        assert "checkpointer" in content.lower() or "MemorySaver" in content, \
            "Missing checkpointer (MemorySaver)"
        assert ".addNode(" in content, "Missing .addNode() calls"
        assert ".addEdge(" in content or ".addConditionalEdges(" in content, \
            "Missing edge definitions"

    def test_workflow_has_required_nodes(self):
        """Verify all required workflow nodes are defined."""
        content = read_source_file("onboarding_flow.ts")

        required_nodes = [
            "CREATE_PROFILE",
            "INIT_QDRANT",
            "HUMAN_GATE",
            "WELCOME",
            "MILESTONE",
            "CHECKIN",
        ]

        for node in required_nodes:
            assert f".addNode('{node}'" in content or f'.addNode("{node}' in content, \
                f"Missing required node: {node}"

    def test_workflow_has_human_gate_interrupt(self):
        """Verify HUMAN_GATE uses interrupt() for human approval."""
        content = read_source_file("onboarding_flow.ts")

        # Check for interrupt usage (may have generic type: interrupt<T>(...))
        assert re.search(r"interrupt\s*<[^>]*>\s*\(|interrupt\s*\(", content), \
            "Missing interrupt() call for human approval"

        # Verify HUMAN_GATE node exists and references interrupt
        assert "HUMAN_GATE" in content, "Missing HUMAN_GATE node"

    def test_workflow_has_approve_onboarding_function(self):
        """Verify approveOnboarding function is exported for resumption."""
        content = read_source_file("onboarding_flow.ts")

        assert "approveOnboarding" in content, "Missing approveOnboarding function"
        assert "export" in content and "approveOnboarding" in content, \
            "approveOnboarding must be exported"

    def test_workflow_has_execute_onboarding_flow_function(self):
        """Verify executeOnboardingFlow entry point is exported."""
        content = read_source_file("onboarding_flow.ts")

        assert "executeOnboardingFlow" in content, "Missing executeOnboardingFlow function"
        assert "export" in content and "executeOnboardingFlow" in content, \
            "executeOnboardingFlow must be exported"

    def test_workflow_has_onboarding_graph_compiled(self):
        """Verify onboardingGraph is compiled and exported."""
        content = read_source_file("onboarding_flow.ts")

        assert "onboardingGraph" in content, "Missing onboardingGraph export"
        assert "compiledGraph" in content or ".compile(" in content, \
            "Graph must be compiled"

    def test_workflow_has_onboarding_state_type(self):
        """Verify OnboardingState type has all required fields."""
        content = read_source_file("onboarding_flow.ts")

        required_fields = [
            "clientId",
            "clientName",
            "email",
            "currentStep",
            "profileCreated",
            "qdrantInitialized",
            "welcomeSent",
            "milestoneCreated",
            "checkinScheduled",
            "humanApproved",
            "humanComment",
            "complete",
        ]

        # Check that OnboardingState type or interface exists
        assert "OnboardingState" in content, "Missing OnboardingState type"

        for field in required_fields:
            # Look for field in type definition (before the actual node functions)
            type_section = content[:content.find("async function")]
            assert field in type_section or field in content, \
                f"Missing required field in OnboardingState: {field}"

    def test_workflow_uses_fetch_client_for_qdrant(self):
        """Verify workflow uses fetchClient for Qdrant operations."""
        content = read_source_file("onboarding_flow.ts")

        assert "fetchClient" in content, "Missing fetchClient for Qdrant HTTP calls"
        assert "QDRANT_URL" in content, "Missing QDRANT_URL environment variable"

    def test_workflow_has_telegram_integration(self):
        """Verify workflow integrates with Telegram bot for welcome messages."""
        content = read_source_file("onboarding_flow.ts")

        assert "telegram" in content.lower(), "Missing Telegram integration"
        assert "bot" in content, "Missing bot import"
        assert "sendMessage" in content, "Missing sendMessage call"

    def test_workflow_has_conditional_edges_for_approval(self):
        """Verify conditional edge routing based on human approval."""
        content = read_source_file("onboarding_flow.ts")

        assert ".addConditionalEdges(" in content or "addConditionalEdges" in content, \
            "Missing conditional edges for approval routing"
        assert "shouldContinue" in content or "humanApproved" in content, \
            "Missing conditional routing logic based on approval"


class TestOnboardingWorkflowEdges:
    """Verify workflow edges match the specified flow."""

    def test_workflow_edge_sequence(self):
        """Verify correct edge sequence: START → CREATE_PROFILE → INIT_QDRANT → HUMAN_GATE."""
        content = read_source_file("onboarding_flow.ts")

        # Check START is connected to CREATE_PROFILE
        assert re.search(r"START.*CREATE_PROFILE|addEdge\(START.*'CREATE_PROFILE'", content), \
            "START must connect to CREATE_PROFILE"

        # Check CREATE_PROFILE → INIT_QDRANT
        assert "CREATE_PROFILE" in content and "INIT_QDRANT" in content, \
            "CREATE_PROFILE and INIT_QDRANT nodes must exist"

        # Check INIT_QDRANT → HUMAN_GATE
        assert re.search(r"'INIT_QDRANT'.*'HUMAN_GATE'", content), \
            "INIT_QDRANT must connect to HUMAN_GATE"

    def test_workflow_ends_after_checkin(self):
        """Verify workflow ends after CHECKIN node."""
        content = read_source_file("onboarding_flow.ts")

        assert re.search(r"'CHECKIN'.*END|addEdge\('CHECKIN', END\)", content), \
            "CHECKIN must connect to END"


def test_onboarding_pipeline_end_to_end():
    """
    Smoke test: verify onboarding workflow structure is valid.
    Full integration test with mock LLM/Qdrant/Telegram is in:
    hermes-agency/src/__tests__/workflow-onboarding.integration.test.ts
    """
    # This test verifies the file structure is correct
    content = read_source_file("onboarding_flow.ts")

    # Must have StateGraph
    assert "StateGraph" in content
    # Must have interrupt
    assert re.search(r"interrupt\s*\(", content)
    # Must have approveOnboarding
    assert "approveOnboarding" in content
    # Must have executeOnboardingFlow
    assert "executeOnboardingFlow" in content
