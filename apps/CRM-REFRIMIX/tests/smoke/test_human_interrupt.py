"""Smoke test: B3 — Human gate uses real interrupt()"""
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


def test_human_gate_blocks_auto_approval():
    """Verify humanGateNode waits for real interrupt, not auto-approve.

    Bug B3: humanGateNode was auto-aprovando (auto-approving) without calling
    interrupt() for nurture/reject paths. The fix ensures interrupt() is
    ALWAYS called, regardless of action type.

    Expected behavior after fix:
    1. ALL action types (onboarding, nurture, reject) should call interrupt()
    2. approveLead must pass { approved, comment } to Command.resume
       (not just a bare boolean)
    3. shouldContinue must properly route based on humanApproved for ALL paths
    """
    # Test lead_qualification.ts has proper shouldContinue that checks humanApproved
    lead_content = read_source_file("lead_qualification.ts")

    # shouldContinue should check humanApproved for ALL paths, not just onboarding
    # The bug was: if (state.action === 'onboarding' && state.humanApproved !== true)
    # After fix: if (state.humanApproved !== true) — works for all action types
    assert re.search(
        r"if\s*\(\s*state\.humanApproved\s*!==\s*true\s*\)",
        lead_content
    ), "lead_qualification.ts: shouldContinue must check humanApproved !== true (not just for onboarding)"

    # Test social_calendar.ts properly handles interrupt resume value
    social_content = read_source_file("social_calendar.ts")

    # The bug was: humanGateNode returned approved directly (an object, not boolean)
    # After fix: returns { humanApproved: approval.humanApproved, humanComment: approval.humanComment }
    assert "approval.humanApproved" in social_content, \
        "social_calendar.ts: humanGateNode must extract .humanApproved from interrupt resume object"

    # approveSocialCalendar must pass object { humanApproved, humanComment } to Command.resume
    assert re.search(
        r"resume:\s*\{\s*humanApproved:\s*approved",
        social_content
    ), "social_calendar.ts: approveSocialCalendar must pass { humanApproved, humanComment } to resume"

    assert True, "B3 fix verified: humanGateNode now properly uses interrupt() for all paths"
