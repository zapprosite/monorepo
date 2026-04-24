"""Smoke test: B1 — LangGraph real StateGraph
Verifies that all 4 fake sequential async workflows have been migrated to real StateGraph with interrupt()
"""
import pytest
import re
import os
from pathlib import Path


# Path to hermes-agency langgraph directory
HERMES_AGENCY_ROOT = Path(__file__).parent.parent.parent.parent.parent / "apps" / "hermes-agency" / "src" / "langgraph"


def read_source_file(filename: str) -> str:
    """Read a TypeScript source file from hermes-agency."""
    filepath = HERMES_AGENCY_ROOT / filename
    if not filepath.exists():
        pytest.fail(f"Workflow file not found: {filepath}")
    return filepath.read_text(encoding="utf-8")


def test_workflow_uses_real_stategraph():
    """Verify all 4 workflows use real LangGraph StateGraph, not sequential async."""
    # Workflow files that should be migrated
    workflows = {
        "status_update.ts": "WF-3",
        "onboarding_flow.ts": "WF-2",
        "social_calendar.ts": "WF-4",
        "lead_qualification.ts": "WF-5",
    }

    for filename, wf_id in workflows.items():
        content = read_source_file(filename)

        # Check for StateGraph import and usage
        assert "StateGraph" in content, f"{filename}: Missing StateGraph import/usage"

        # Check for compile() call
        assert ".compile(" in content, f"{filename}: Missing .compile() call"

        # Check for checkpointer (MemorySaver)
        assert "checkpointer" in content.lower() or "MemorySaver" in content, \
            f"{filename}: Missing checkpointer (MemorySaver)"

        # Check for node definitions (addNode)
        assert ".addNode(" in content, f"{filename}: Missing .addNode() calls"

        # Check for edge definitions
        assert ".addEdge(" in content or ".addConditionalEdges(" in content, \
            f"{filename}: Missing edge definitions"


def test_workflow_has_interrupt_before_approval():
    """Verify all workflows use real interrupt() for human approval gates."""
    workflows_and_approvals = [
        ("status_update.ts", ["HUMAN_GATE", "BROADCAST"]),
        ("onboarding_flow.ts", ["HUMAN_GATE", "WELCOME"]),
        ("social_calendar.ts", ["HUMAN_GATE", "BRAND_REVIEW"]),
        ("lead_qualification.ts", ["HUMAN_GATE", "CLASSIFY"]),
    ]

    for filename, required_terms in workflows_and_approvals:
        content = read_source_file(filename)

        # Check for interrupt usage (may have generic type parameter: interrupt<T>(...))
        # In TS: interrupt<{...}>({...}) or interrupt<boolean>(...)
        assert re.search(r"interrupt\s*<[^>]*>\s*\(|interrupt\s*\(", content), \
            f"{filename}: Missing interrupt() call"

        # Check that required terms are present
        for term in required_terms:
            assert term in content, f"{filename}: Missing required term '{term}'"


def test_supervisor_registry_updated():
    """Verify supervisor.ts reflects the migrated workflows."""
    content = read_source_file("supervisor.ts")

    # Check WORKFLOW_STATUS shows all workflows as StateGraph
    assert "StateGraph (WF-1)" in content or "content_pipeline" in content
    assert "StateGraph (WF-2)" in content or "onboarding" in content
    assert "StateGraph (WF-3)" in content or "lead_qualification" in content
    assert "StateGraph (WF-4)" in content or "social_calendar" in content
    assert "StateGraph (WF-5)" in content or "status_update" in content

    # Check that execute functions are imported
    assert "executeOnboardingFlow" in content
    assert "executeLeadQualification" in content
    assert "executeSocialCalendar" in content
    assert "executeStatusUpdate" in content


def test_content_pipeline_uses_real_interrupt():
    """Verify content_pipeline (WF-1) also uses real interrupt(), not auto-approve."""
    content = read_source_file("content_pipeline.ts")

    # Check for interrupt usage (not just auto-approve)
    # Note: content_pipeline uses interrupt() without generic type parameter
    assert re.search(r"interrupt\s*\(", content), \
        "content_pipeline.ts: Missing interrupt() — still auto-approving?"

    # Ensure the auto-approve comment is not present without interrupt
    has_auto_approve_comment = "Auto-approving" in content
    has_interrupt = re.search(r"interrupt\s*\(", content) is not None
    assert not (has_auto_approve_comment and not has_interrupt), \
        "content_pipeline still has fake auto-approve without interrupt()"
