"""
Integration test: B9 — Real integration tests for CRM workflows

This test file invokes the actual hermes-agency workflow integration tests and verifies
that all workflow integration tests pass.

Bug B9: 0 tests de integracao real no CRM
Fix: Run actual vitest workflow integration tests via subprocess

Run: cd apps/CRM-REFRIMIX && pytest tests/integration/test_hermes_workflows_real.py -v
"""
import json
import subprocess
import os
import pytest
from pathlib import Path


# Monorepo root
MONOREPO_ROOT = Path(__file__).parent.parent.parent.parent.parent


WORKFLOW_TESTS = [
    'workflow-onboarding',
    'workflow-content-pipeline',
    'workflow-lead-qualification',
    'workflow-social-calendar',
    'workflow-status-update',
    'workflow-supervisor',
]


def run_vitest_workflow_test(workflow_name: str) -> dict:
    """
    Run a specific workflow integration test in hermes-agency.

    Returns dict with:
      - returncode: int
      - stdout: str
      - stderr: str
      - tests_passed: int
      - tests_failed: int
      - tests_total: int
      - all_passed: bool
      - workflow: str
    """
    hermes_dir = MONOREPO_ROOT / "apps" / "hermes-agency"

    env = os.environ.copy()
    result = subprocess.run(
        ["pnpm", "test", "--", workflow_name, "--reporter=json"],
        cwd=str(hermes_dir),
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )

    tests_passed = 0
    tests_failed = 0
    tests_total = 0

    try:
        lines = result.stdout.strip().split('\n')
        for line in lines:
            if line.strip().startswith('{'):
                try:
                    data = json.loads(line)
                    if 'numTotalTests' in data:
                        tests_total = data.get('numTotalTests', 0)
                        tests_passed = data.get('numPassedTests', 0)
                        tests_failed = data.get('numFailedTests', 0)
                except json.JSONDecodeError:
                    pass
    except Exception:
        pass

    all_passed = result.returncode == 0 and tests_failed == 0

    return {
        'returncode': result.returncode,
        'stdout': result.stdout,
        'stderr': result.stderr,
        'tests_passed': tests_passed,
        'tests_failed': tests_failed,
        'tests_total': tests_total,
        'all_passed': all_passed,
        'workflow': workflow_name,
    }


def get_hermes_test_results() -> dict:
    """
    Run all hermes-agency workflow integration tests.

    Returns aggregated results dict with:
      - workflows: list of per-workflow result dicts
      - total_passed: int
      - total_failed: int
      - total_tests: int
      - all_passed: bool
    """
    workflow_results = []

    for workflow in WORKFLOW_TESTS:
        result = run_vitest_workflow_test(workflow)
        workflow_results.append(result)

    total_passed = sum(r['tests_passed'] for r in workflow_results)
    total_failed = sum(r['tests_failed'] for r in workflow_results)
    total_tests = sum(r['tests_total'] for r in workflow_results)
    all_passed = all(r['all_passed'] for r in workflow_results)

    return {
        'workflows': workflow_results,
        'total_passed': total_passed,
        'total_failed': total_failed,
        'total_tests': total_tests,
        'all_passed': all_passed,
    }


def test_hermes_agency_vitest_suite_runs():
    """
    Verify hermes-agency vitest suite can execute without crashing.
    This is a basic sanity check that the test infrastructure works.
    """
    result = run_vitest_workflow_test('workflow-onboarding')

    assert result['returncode'] == 0 or result['tests_total'] > 0, \
        f"Hermes vitest suite failed to run: {result['stderr'][-500:]}"


def test_hermes_onboarding_workflow_integration():
    """
    Test onboarding workflow (WF-2) integration tests pass.

    The onboarding workflow tests verify:
    - CREATE_PROFILE → INIT_QDRANT → HUMAN_GATE → WELCOME → MILESTONE → CHECKIN
    - interrupt() at HUMAN_GATE waits for approveOnboarding()
    - approveOnboarding(clientId, true) resumes with humanApproved=true
    - approveOnboarding(clientId, false) rejects
    - Qdrant client profile created via fetchClient
    - Telegram welcome message sent
    - Error handling when Qdrant/fetch fails
    """
    result = run_vitest_workflow_test('workflow-onboarding')

    assert result['all_passed'], \
        f"Hermes onboarding integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_content_pipeline_integration():
    """
    Test content pipeline (WF-1) integration tests pass.

    The content pipeline tests verify:
    - CREATIVE → VIDEO → DESIGN → BRAND_GUARDIAN → HUMAN_GATE/SOCIAL → ANALYTICS
    - brandScore >= 0.8 → skips HUMAN_GATE
    - brandScore < 0.8 → interrupts at HUMAN_GATE
    - approveContentPipeline(campaignId, approved) resumes workflow
    - LLM calls via llmComplete()
    - Error handling when LLM fails
    """
    result = run_vitest_workflow_test('workflow-content-pipeline')

    assert result['all_passed'], \
        f"Hermes content pipeline integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_lead_qualification_integration():
    """
    Test lead qualification workflow (WF-5) integration tests pass.
    """
    result = run_vitest_workflow_test('workflow-lead-qualification')

    assert result['all_passed'], \
        f"Hermes lead qualification integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_social_calendar_integration():
    """
    Test social calendar workflow (WF-4) integration tests pass.
    """
    result = run_vitest_workflow_test('workflow-social-calendar')

    assert result['all_passed'], \
        f"Hermes social calendar integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_status_update_integration():
    """
    Test status update workflow (WF-3) integration tests pass.
    """
    result = run_vitest_workflow_test('workflow-status-update')

    assert result['all_passed'], \
        f"Hermes status update integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_supervisor_integration():
    """
    Test supervisor workflow integration tests pass.
    """
    result = run_vitest_workflow_test('workflow-supervisor')

    assert result['all_passed'], \
        f"Hermes supervisor integration tests failed:\nstdout: {result['stdout'][-1000:]}\nstderr: {result['stderr'][-500:]}"


def test_hermes_workflow_integration_summary():
    """
    Summary test: verify all hermes-agency workflow integration tests pass.

    This aggregates all workflow integration tests:
    - workflow-onboarding.integration.test.ts
    - workflow-content-pipeline.integration.test.ts
    - workflow-lead-qualification.integration.test.ts
    - workflow-social-calendar.integration.test.ts
    - workflow-status-update.integration.test.ts
    - workflow-supervisor.integration.test.ts
    """
    results = get_hermes_test_results()

    # Print summary for debugging
    print(f"\n=== Hermes Workflow Integration Test Summary ===")
    print(f"Total tests: {results['total_tests']}")
    print(f"Passed: {results['total_passed']}")
    print(f"Failed: {results['total_failed']}")

    for r in results['workflows']:
        status = "PASS" if r['all_passed'] else "FAIL"
        print(f"  {r['workflow']}: {r['tests_passed']}/{r['tests_total']} {status}")

    if results['total_failed'] > 0:
        for r in results['workflows']:
            if not r['all_passed']:
                print(f"\n=== Failures in {r['workflow']} ===")
                print(r['stdout'][-1500:])

    assert results['total_tests'] > 0, "No workflow integration tests were collected"
    assert results['total_failed'] == 0, f"{results['total_failed']} workflow integration tests failed"
    assert results['all_passed'], "Some hermes-agency workflow integration tests failed"
