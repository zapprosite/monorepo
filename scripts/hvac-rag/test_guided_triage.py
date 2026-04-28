#!/usr/bin/env python3
"""
Edge Case Tests for HVAC Guided Triage Mode

Testa casos especiais e edge cases do modo guided_triage.
"""

import sys
import os
import importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

def import_local_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(SCRIPT_DIR, filename))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

_juiz = import_local_module("hvac_juiz", "hvac-juiz.py")
judge = _juiz.judge
JuizResult = _juiz.JuizResult

def test_edge_cases():
    """Test edge cases for guided_triage detection."""
    test_cases = [
        # (query, should_be_guided, description)

        # Basic guided_triage cases
        ("erro e4 vrv daikin", True, "brand+family+error"),
        ("E4 VRV Daikin error", True, "case insensitive"),
        ("daikin vrv erro e4", True, "portuguese order"),

        # With subcode - still guided if no full model
        ("e4-01 daikin vrv", True, "has subcode but no full model"),
        ("E4-001 Carrier VRF", True, "3-digit subcode"),

        # NOT guided - has complete model
        ("RXYQ20BRA erro e4 vrv", False, "has complete model"),
        ("RYYQ48BRA E4 VRV Daikin", False, "has complete model prefix"),

        # NOT guided - missing family
        ("erro e4 daikin", False, "no family VRV/VRF"),
        ("e4 daikin split", False, "split instead of VRV"),

        # NOT guided - no error code
        ("vrv daikin manutenção", False, "no error code"),
        ("daikin vrv procedimento", False, "no error code"),

        # VRF variations
        ("vrf carrier e3 erro", True, "VRF with error"),

        # Split/Hi-wall should NOT trigger guided VRV
        ("erro e4 split daikin", False, "split not VRV"),
        ("e4 hi-wall daikin", False, "hi-wall not VRV"),

        # Other brands
        ("e4 vrv carrier", True, "carrier brand"),
        ("e4 vrv midea", True, "midea brand"),
        ("e3 vrv lg", True, "lg brand"),

        # No brand - still guided if family+error
        ("vrv erro e4", False, "no brand, should not be guided - brand is required"),
    ]

    print("=== Edge Case Tests ===\n")
    passed = 0
    failed = 0

    for query, should_be, desc in test_cases:
        result, meta = judge(query)
        is_guided = (result == JuizResult.GUIDED_TRIAGE)

        if is_guided == should_be:
            print(f"✅ {desc}: {query[:40]}")
            passed += 1
        else:
            print(f"❌ {desc}: {query[:40]}")
            print(f"   Expected guided={should_be}, got {result.value}")
            failed += 1

    print(f"\n{passed}/{passed+failed} passed")
    return failed == 0

def test_ux_rules():
    """Test that UX rules are properly encoded."""
    # These are harder to test without LLM, but we can verify Juiz metadata
    test_cases = [
        ("erro e4 vrv daikin", {"guided_triage": True}),
        ("RXYQ20BRA erro e4", {"guided_triage": False}),
    ]

    print("\n=== UX Metadata Tests ===\n")
    passed = 0
    failed = 0

    for query, expected_meta in test_cases:
        result, meta = judge(query)
        for key, expected_val in expected_meta.items():
            actual_val = meta.get(key, False)
            if actual_val == expected_val:
                print(f"✅ {key}={actual_val} for {query[:30]}")
                passed += 1
            else:
                print(f"❌ {key}={actual_val} (expected {expected_val}) for {query[:30]}")
                failed += 1

    print(f"\n{passed}/{passed+failed} passed")
    return failed == 0

if __name__ == "__main__":
    ok1 = test_edge_cases()
    ok2 = test_ux_rules()
    sys.exit(0 if (ok1 and ok2) else 1)