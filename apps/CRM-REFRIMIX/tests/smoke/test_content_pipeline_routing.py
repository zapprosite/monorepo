"""Smoke test: B4 — Content pipeline conditional edges
Verifies that content_pipeline uses conditional edges for dynamic routing
based on content type, not fixed edges.
"""
import pytest
import re
from pathlib import Path


# Path to hermes-agency langgraph directory
HERMES_AGENCY_ROOT = Path(__file__).parent.parent.parent.parent.parent / "apps" / "hermes-agency" / "src" / "langgraph"


def read_source_file(filename: str = "content_pipeline.ts") -> str:
    """Read a TypeScript source file from hermes-agency."""
    filepath = HERMES_AGENCY_ROOT / filename
    if not filepath.exists():
        pytest.fail(f"Workflow file not found: {filepath}")
    return filepath.read_text(encoding="utf-8")


def test_content_pipeline_has_conditional_edges():
    """Verify content_pipeline uses conditional edges, not fixed edges.

    BUG: The original implementation had fixed edges:
        .addEdge('CREATIVE', 'VIDEO')
        .addEdge('VIDEO', 'DESIGN')
        .addEdge('DESIGN', 'BRAND_GUARDIAN')

    FIX: Now uses conditional edges based on contentType:
        - video: CREATIVE → VIDEO → DESIGN → BRAND_GUARDIAN
        - blog:  CREATIVE → DESIGN → BRAND_GUARDIAN (skip VIDEO)
        - social/email: CREATIVE → BRAND_GUARDIAN (skip VIDEO and DESIGN)
    """
    content = read_source_file()

    # Check that fixed edges NO longer exist (the bug was: .addEdge('CREATIVE', 'VIDEO'))
    # After fix: should be .addConditionalEdges('CREATIVE', creativeRouter, ...)
    assert ".addConditionalEdges('CREATIVE'" in content, \
        "content_pipeline.ts: Missing addConditionalEdges for CREATIVE — still using fixed edge?"

    # Check that the fixed edge pattern is NOT present (the bug)
    # The bug was: .addEdge('CREATIVE', 'VIDEO')
    assert not re.search(r"\.addEdge\s*\(\s*['\"]CREATIVE['\"]\s*,\s*['\"]VIDEO['\"]\s*\)", content), \
        "content_pipeline.ts: Still has fixed edge CREATIVE → VIDEO (should be conditional)"

    # Verify creativeRouter function exists
    assert "function creativeRouter" in content or "const creativeRouter" in content, \
        "content_pipeline.ts: Missing creativeRouter function"

    # Verify contentType is in the state interface
    assert "contentType:" in content or "contentType :" in content, \
        "content_pipeline.ts: Missing contentType in state interface"


def test_content_pipeline_creative_router_logic():
    """Verify creativeRouter correctly routes based on contentType."""
    content = read_source_file()

    # Check that creativeRouter handles different content types
    # The code uses `ct === 'video'` where ct is `state.contentType`
    assert "ct === 'video'" in content or "ct === \"video\"" in content, \
        "content_pipeline.ts: creativeRouter missing video contentType handling"

    assert "ct === 'blog'" in content or "ct === \"blog\"" in content, \
        "content_pipeline.ts: creativeRouter missing blog contentType handling"

    # Check that video routes to VIDEO
    assert re.search(r"ct === 'video'.*return\s+['\"]VIDEO['\"]", content, re.DOTALL) or \
           re.search(r'ct === "video".*return\s+["\']VIDEO["\']', content, re.DOTALL), \
        "content_pipeline.ts: creativeRouter not returning VIDEO for video contentType"

    # Check that blog routes to DESIGN (skipping VIDEO)
    assert re.search(r"ct === 'blog'.*return\s+['\"]DESIGN['\"]", content, re.DOTALL) or \
           re.search(r'ct === "blog".*return\s+["\']DESIGN["\']', content, re.DOTALL), \
        "content_pipeline.ts: creativeRouter not returning DESIGN for blog contentType"


def test_content_pipeline_video_and_design_routers():
    """Verify VIDEO and DESIGN also use conditional edges (for consistency)."""
    content = read_source_file()

    # VIDEO should route to DESIGN
    assert re.search(r"function videoRouter.*return\s+['\"]DESIGN['\"]", content, re.DOTALL), \
        "content_pipeline.ts: videoRouter should route to DESIGN"

    # DESIGN should route to BRAND_GUARDIAN
    assert re.search(r"function designRouter.*return\s+['\"]BRAND_GUARDIAN['\"]", content, re.DOTALL), \
        "content_pipeline.ts: designRouter should route to BRAND_GUARDIAN"

    # Both should use addConditionalEdges
    assert ".addConditionalEdges('VIDEO'" in content, \
        "content_pipeline.ts: VIDEO should use addConditionalEdges"
    assert ".addConditionalEdges('DESIGN'" in content, \
        "content_pipeline.ts: DESIGN should use addConditionalEdges"


def test_execute_content_pipeline_accepts_content_type():
    """Verify executeContentPipeline function accepts contentType parameter."""
    content = read_source_file()

    # The function should accept contentType parameter with default 'social'
    assert re.search(
        r"executeContentPipeline\s*\([^)]*contentType\s*:\s*ContentType",
        content
    ), "executeContentPipeline should accept contentType parameter"

    # Should have a default value of 'social'
    assert "contentType: ContentType = 'social'" in content or \
           "contentType: ContentType = \"social\"" in content, \
        "executeContentPipeline should default contentType to 'social'"


def test_content_pipeline_state_has_content_type():
    """Verify PipelineState interface includes contentType field."""
    content = read_source_file()

    # Check for PipelineState interface
    assert "interface PipelineState" in content, \
        "content_pipeline.ts: Missing PipelineState interface"

    # Check for contentType in the interface
    assert re.search(r"contentType\s*:\s*ContentType", content), \
        "content_pipeline.ts: PipelineState missing contentType field"


def test_graph_channels_include_content_type():
    """Verify the StateGraph channels include contentType."""
    content = read_source_file()

    # Check that contentType is in the channels definition
    assert "contentType: { type: 'string' }" in content or \
           "contentType: { type: " in content, \
        "content_pipeline.ts: StateGraph channels missing contentType"
