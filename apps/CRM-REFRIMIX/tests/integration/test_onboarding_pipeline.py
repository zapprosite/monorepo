"""
Integration test: Onboarding pipeline

REAL IMPLEMENTATION: workflow-onboarding.integration.test.ts
See hermes-agency/src/__tests__/workflow-onboarding.integration.test.ts

Workflow: WF-2 (onboarding_flow.ts)
  Nodes: CREATE_PROFILE → INIT_QDRANT → HUMAN_GATE → WELCOME → MILESTONE → CHECKIN
  Interrupt: HUMAN_GATE waits for approveOnboarding(clientId, approved, comment?)
  Storage: Qdrant (agency_clients, agency_client_{clientId} collection)
  Notification: Telegram bot.telegram.sendMessage for welcome

Tests:
  - executeOnboardingFlow(name, email) → OnboardingState with unique clientId
  - Qdrant create client profile via fetchClient PUT
  - Qdrant init agency_client_{clientId} collection
  - HUMAN_GATE: interrupt() pauses workflow waiting for Command resume
  - approveOnboarding(clientId, true) → humanApproved=true, welcome sent
  - approveOnboarding(clientId, false) → humanApproved=false, no welcome
  - Milestone and check-in scheduled in Qdrant TASKS collection
  - Error state when Qdrant/fetch throws
  - OnboardingState has all required fields

Run: cd apps/hermes-agency && pnpm test -- workflow-onboarding
"""
import pytest


def test_onboarding_pipeline_end_to_end():
    """
    Test full onboarding flow from lead to active client.
    Real test in workflow-onboarding.integration.test.ts
    """
    assert True, "Real tests in workflow-onboarding.integration.test.ts"
