"""Smoke test: Workflow Signup (Onboarding Flow WF-2)
Verifies the client signup/onboarding workflow uses real LangGraph StateGraph with interrupt()
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


def test_signup_workflow_uses_real_stategraph():
    """Verify signup workflow (onboarding_flow.ts) uses real LangGraph StateGraph."""
    content = read_source_file("onboarding_flow.ts")

    # Check for StateGraph import and usage
    assert "StateGraph" in content, "onboarding_flow.ts: Missing StateGraph import/usage"

    # Check for compile() call
    assert ".compile(" in content, "onboarding_flow.ts: Missing .compile() call"

    # Check for checkpointer (MemorySaver)
    assert "checkpointer" in content.lower() or "MemorySaver" in content, \
        "onboarding_flow.ts: Missing checkpointer (MemorySaver)"

    # Check for node definitions (addNode)
    assert ".addNode(" in content, "onboarding_flow.ts: Missing .addNode() calls"

    # Check for edge definitions
    assert ".addEdge(" in content or ".addConditionalEdges(" in content, \
        "onboarding_flow.ts: Missing edge definitions"


def test_signup_workflow_has_interrupt_before_approval():
    """Verify signup workflow uses real interrupt() for human approval gate."""
    content = read_source_file("onboarding_flow.ts")

    # Check for interrupt usage (may have generic type parameter: interrupt<T>(...))
    assert re.search(r"interrupt\s*<[^>]*>\s*\(|interrupt\s*\(", content), \
        "onboarding_flow.ts: Missing interrupt() call"

    # Check that HUMAN_GATE node is present
    assert "HUMAN_GATE" in content, "onboarding_flow.ts: Missing HUMAN_GATE node"

    # Check that WELCOME node is present (after approval)
    assert "WELCOME" in content or "welcomeNode" in content, \
        "onboarding_flow.ts: Missing WELCOME node"


def test_signup_workflow_nodes():
    """Verify signup workflow has all required nodes for client onboarding."""
    content = read_source_file("onboarding_flow.ts")

    # Required nodes for onboarding flow
    required_nodes = [
        "CREATE_PROFILE",  # Create client profile in Qdrant
        "INIT_QDRANT",    # Initialize client-specific Qdrant collection
        "HUMAN_GATE",     # Wait for human approval
        "WELCOME",        # Send welcome message (after approval)
        "MILESTONE",      # Create first milestone
        "CHECKIN",        # Schedule check-in
    ]

    for node in required_nodes:
        assert node in content, f"onboarding_flow.ts: Missing required node '{node}'"


def test_signup_workflow_execute_function():
    """Verify signup workflow exports executeOnboardingFlow function."""
    content = read_source_file("onboarding_flow.ts")

    # Check for execute function export
    assert "executeOnboardingFlow" in content, \
        "onboarding_flow.ts: Missing executeOnboardingFlow function"

    # Check for approveOnboarding function (for resuming after interrupt)
    assert "approveOnboarding" in content, \
        "onboarding_flow.ts: Missing approveOnboarding function"


def test_signup_workflow_state_type():
    """Verify signup workflow has correct OnboardingState type definition."""
    content = read_source_file("onboarding_flow.ts")

    # Check for OnboardingState type
    assert "OnboardingState" in content, "onboarding_flow.ts: Missing OnboardingState type"

    # Check for required state fields
    required_fields = [
        "clientId",
        "clientName",
        "email",
        "currentStep",
        "profileCreated",
        "qdrantInitialized",
        "welcomeSent",
        "humanApproved",
        "complete",
    ]

    for field in required_fields:
        assert field in content, f"onboarding_flow.ts: Missing OnboardingState field '{field}'"


def test_supervisor_registry_has_signup_workflow():
    """Verify supervisor.ts includes the signup/onboarding workflow."""
    content = read_source_file("supervisor.ts")

    # Check that onboarding is registered
    assert "onboarding" in content.lower() or "WF-2" in content, \
        "supervisor.ts: Missing onboarding workflow reference"

    # Check that executeOnboardingFlow is imported/used
    assert "executeOnboardingFlow" in content, \
        "supervisor.ts: Missing executeOnboardingFlow import"


def test_signup_workflow_approve_function():
    """Verify approveOnboarding uses Command to resume from interrupt."""
    content = read_source_file("onboarding_flow.ts")

    # Check for Command import and usage
    assert "Command" in content, "onboarding_flow.ts: Missing Command import"

    # Check that approveOnboarding uses Command to resume
    approve_func_match = re.search(
        r"async function approveOnboarding.*?\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert approve_func_match, "onboarding_flow.ts: Cannot find approveOnboarding function"
    approve_body = approve_func_match.group(1)

    assert "Command" in approve_body, \
        "approveOnboarding: Missing Command usage to resume from interrupt"
    assert "resume" in approve_body, \
        "approveOnboarding: Missing resume value in Command"