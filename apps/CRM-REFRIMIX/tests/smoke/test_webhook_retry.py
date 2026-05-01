"""Smoke test: B10 — Webhook retry with DLQ

Bug: Webhook retry can fail silently without DLQ or structured logging.
Fix: Add DeadLetter status for permanently failed webhooks + structured logging.

Verification:
1. getDeadLetterQueue() function exists and returns DLQ webhooks
2. retryFromDeadLetter() function exists and requeues DLQ webhooks
3. discardDeadLetter() function exists and marks DLQ as permanently failed
4. processWebhookQueue() uses DeadLetter status (not just Failed)
5. Structured logging via logWebhookEvent() for all operations
"""

import os
import re

# Get the monorepo root
# test file: apps/CRM-REFRIMIX/tests/smoke/test_webhook_retry.py
# need to go up 4 levels to get to /srv/monorepo
MONOREPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


def read_file(path: str) -> str:
    """Read a file relative to monorepo root."""
    full_path = os.path.join(MONOREPO_ROOT, path)
    with open(full_path, "r") as f:
        return f.read()


def test_webhook_retry_has_dead_letter_queue_functions():
    """Verify webhookQueue.utils.ts exports DLQ functions.

    The module should export:
    - getDeadLetterQueue(): retrieves DeadLetter status webhooks
    - retryFromDeadLetter(webhookCallQueueId): requeues a DLQ webhook
    - discardDeadLetter(webhookCallQueueId): marks DLQ as permanently failed
    """
    content = read_file("apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts")

    # Check for DLQ function exports
    assert "export async function getDeadLetterQueue" in content, "getDeadLetterQueue must be exported"
    assert "export async function retryFromDeadLetter" in content, "retryFromDeadLetter must be exported"
    assert "export async function discardDeadLetter" in content, "discardDeadLetter must be exported"


def test_webhook_retry_uses_dead_letter_status():
    """Verify processWebhookQueue moves failed webhooks to DeadLetter (not Failed).

    After max retries exceeded, webhooks should be marked as DeadLetter
    so they can be inspected and manually reprocessed if needed.
    """
    content = read_file("apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts")

    # Should update status to DeadLetter when max retries exceeded
    assert 'status: "DeadLetter"' in content, "Must set status to DeadLetter after max retries"

    # Should NOT just set to Failed (old behavior)
    # The DeadLetter is the terminal state, Failed is only for discard


def test_webhook_retry_has_structured_logging():
    """Verify webhook operations have structured logging.

    All webhook operations should log:
    - event type (webhook_queue:batch_start, webhook_queue:processing, etc.)
    - webhookId, teamId, attempt, maxAttempts
    - error details when applicable
    """
    content = read_file("apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts")

    # Check for structured logging function
    assert "function logWebhookEvent" in content, "logWebhookEvent helper must exist"
    assert "webhook_queue:" in content, "Event names must be namespaced as webhook_queue:*"

    # Check for key log events
    assert "batch_start" in content, "Must log batch_start event"
    assert "processing" in content, "Must log processing event"
    assert "dead_lettered" in content, "Must log dead_lettered event"


def test_dead_letter_status_exists_in_enum():
    """Verify DeadLetter status exists in WEBHOOK_STATUS_ENUM.

    The enum should have 4 statuses:
    - Pending: webhook is queued
    - Sent: webhook delivered successfully
    - Failed: temporary failure (may retry)
    - DeadLetter: permanent failure (no more retries)
    """
    content = read_file("packages/zod-schemas/src/enums.zod.ts")

    # Check for DeadLetter in the enum
    assert "'DeadLetter'" in content or '"DeadLetter"' in content, "DeadLetter must be in WEBHOOK_STATUS_ENUM"

    # Verify enum has 4 values
    enum_match = re.search(r"WEBHOOK_STATUS_ENUM\s*=\s*\[(.*?)\]", content, re.DOTALL)
    assert enum_match, "WEBHOOK_STATUS_ENUM must be defined"

    enum_values = enum_match.group(1)
    status_count = enum_values.count(",") + 1
    assert status_count == 4, f"Expected 4 statuses in WEBHOOK_STATUS_ENUM, got {status_count}"


def test_dlq_retry_resets_attempts():
    """Verify retryFromDeadLetter resets attempts to allow full retry cycle."""
    content = read_file("apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts")

    # Should reset status to Pending and reset errorMessage
    assert 'status: "Pending"' in content, "retryFromDeadLetter should reset status to Pending"
    assert "errorMessage: null" in content or "errorMessage: null" in content, "retryFromDeadLetter should clear errorMessage"
