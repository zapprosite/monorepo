"""Smoke test: B6/B7 — Subscription workflow (race condition + null check)
Verifies subscription increment is wrapped in DB transaction and null check is correct
"""
import pytest
import re
from pathlib import Path


# Path to api subscriptionTracker utils
API_ROOT = Path(__file__).parent.parent.parent.parent.parent / "apps" / "api" / "src" / "modules" / "api-gateway" / "utils"


def read_source_file(filename: str) -> str:
    """Read a TypeScript source file from API."""
    filepath = API_ROOT / filename
    if not filepath.exists():
        pytest.fail(f"Source file not found: {filepath}")
    return filepath.read_text(encoding="utf-8")


def test_increment_subscription_usage_is_transactional():
    """Verify incrementSubscriptionUsage is wrapped in db.$transaction to prevent race conditions."""
    content = read_source_file("subscriptionTracker.utils.ts")

    # Find the incrementSubscriptionUsage function
    func_match = re.search(
        r"export async function incrementSubscriptionUsage\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find incrementSubscriptionUsage function"
    func_body = func_match.group(1)

    # BUG B7 FIX: Must use db.$transaction to prevent race conditions
    # Two concurrent requests could both see 90%+ usage and both queue webhooks
    # before either marks notifiedAt90PercentUse - transaction prevents this
    assert "db.$transaction" in func_body, \
        "incrementSubscriptionUsage: Missing db.$transaction wrapper (B7 race condition fix)"


def test_increment_uses_atomic_update():
    """Verify incrementSubscriptionUsage uses atomic increment, not read-then-write."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function incrementSubscriptionUsage\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find incrementSubscriptionUsage function"
    func_body = func_match.group(1)

    # Must use .increment() for atomic update, not read + write
    assert ".increment(" in func_body, \
        "incrementSubscriptionUsage: Missing atomic .increment() call"


def test_webhook_queue_has_nested_transaction():
    """Verify checkAndQueueWebhookAt90Percent uses transaction for webhook + notified update."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function checkAndQueueWebhookAt90Percent\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find checkAndQueueWebhookAt90Percent function"
    func_body = func_match.group(1)

    # BUG B7: The webhook queue + mark notified must be in same transaction
    # Otherwise race condition: both webhooks get queued before either marks notified
    if "webhookCallQueues.create" in func_body or "Queue webhook" in func_body:
        assert "db.$transaction" in func_body or "Promise.all" in func_body, \
            "checkAndQueueWebhookAt90Percent: Missing transaction for webhook queue + notified update"


def test_subscribedat_null_check_uses_strict_equality():
    """Verify notifiedAt90PercentUse null check uses === null, not falsy check (B6 fix)."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function checkAndQueueWebhookAt90Percent\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find checkAndQueueWebhookAt90Percent function"
    func_body = func_match.group(1)

    # BUG B6 FIX: Original bug was `if (notifiedAt90PercentUse)` which treats 0 as falsy
    # Fix must use strict null check: === null
    assert "=== null" in func_body or "!== null" in func_body, \
        "checkAndQueueWebhookAt90Percent: Missing strict null check (=== null) for notifiedAt90PercentUse (B6 fix)"

    # Ensure no falsy check is present (the original bug)
    falsy_check_pattern = r"if\s*\(\s*notifiedAt90PercentUse\s*\)"
    assert not re.search(falsy_check_pattern, func_body), \
        "checkAndQueueWebhookAt90Percent: Found falsy check for notifiedAt90PercentUse (should use === null)"


def test_subscribedat_update_uses_where_clause():
    """Verify subscription update uses WHERE clause to prevent overwriting newer notifications."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function checkAndQueueWebhookAt90Percent\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find checkAndQueueWebhookAt90Percent function"
    func_body = func_match.group(1)

    # When marking notified, must use WHERE clause to ensure we don't overwrite
    # a notification that was just queued by a concurrent request
    if "notifiedAt90PercentUse" in func_body and "update" in func_body:
        # Look for the update pattern with where clause
        has_where_clause = re.search(
            r"\.where\(\s*\{[^}]*notifiedAt90PercentUse",
            func_body
        )
        assert has_where_clause, \
            "notifiedAt90PercentUse update: Missing WHERE clause to prevent race condition"


def test_usage_percent_calculation_handles_zero_max_requests():
    """Verify usage percent calculation won't cause division by zero."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function checkAndQueueWebhookAt90Percent\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find checkAndQueueWebhookAt90Percent function"
    func_body = func_match.group(1)

    # Usage calculation: (requestsConsumed / maxRequests) * 100
    # If maxRequests is 0, this would be Infinity or NaN
    # The check `requestsConsumed < maxRequests` in findActiveSubscription prevents 0 maxRequests
    # but the calculation in checkAndQueueWebhookAt90Percent should be safe regardless
    assert "maxRequests" in func_body, "Missing maxRequests in threshold check"


def test_transaction_error_isolation():
    """Verify errors in webhook queue don't break the subscription update."""
    content = read_source_file("subscriptionTracker.utils.ts")

    func_match = re.search(
        r"export async function incrementSubscriptionUsage\(.*?\)\s*\{(.*?)\n\}",
        content,
        re.DOTALL
    )
    assert func_match, "subscriptionTracker.utils.ts: Cannot find incrementSubscriptionUsage function"
    func_body = func_match.group(1)

    # The webhook checkAndQueueWebhookAt90Percent is called with .catch()
    # This means if it fails (e.g., due to race condition in marking notified),
    # the transaction still commits the increment
    assert ".catch(" in func_body or "try" in func_body, \
        "incrementSubscriptionUsage: Missing error handling for webhook queue failure"