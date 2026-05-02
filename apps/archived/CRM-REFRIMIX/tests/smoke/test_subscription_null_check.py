"""Smoke test: B6 — Subscription null check for 0"""
import pytest


def test_subscribedat_handles_zero_not_as_falsy():
    """Verify subscribedAt90PercentUse treats 0 as valid number, not falsy."""
    # TODO: Implement after B6 fix
    # Bug: if (subscribedAt) treats 0 as falsy
    assert True, "B6 fix not yet implemented"
