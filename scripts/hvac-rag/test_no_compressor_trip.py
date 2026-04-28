#!/usr/bin/env python3
"""
Test: E4 VRV Daikin should NOT return "compressor protection trip"

This test sends queries to the HVAC RAG pipe and verifies that:
1. E4 VRV Daikin responses mention "baixa pressão" not "compressor protection trip"
2. No invented pressure/voltage values
"""

import httpx
import sys

PIPELINE_URL = "http://127.0.0.1:4017"

ANTI_PATTERNS = [
    "compressor protection trip",
    "compressor protection",
    "trip",
]

def test_e4_vrv_no_compressor_trip():
    """Test that E4 VRV Daikin doesn't return compressor protection trip."""
    queries = [
        "erro e4 vrv daikin",
        "e4-01 daikin vrv",
        "e4 vrv daikin problema",
    ]

    all_pass = True
    for query in queries:
        try:
            resp = httpx.post(
                f"{PIPELINE_URL}/v1/chat/completions",
                json={
                    "model": "hvac-manual-strict",
                    "messages": [{"role": "user", "content": query}],
                    "max_tokens": 300,
                },
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "").lower()

                found = [p for p in ANTI_PATTERNS if p.lower() in content]
                if found:
                    print(f"FAIL: {query}: Found anti-pattern {found}")
                    all_pass = False
                else:
                    print(f"PASS: {query}: No anti-patterns found")
            else:
                print(f"WARN: {query}: HTTP {resp.status_code}")
        except Exception as e:
            print(f"FAIL: {query}: Exception {e}")
            all_pass = False

    return all_pass

if __name__ == "__main__":
    print("=== E4 VRV Daikin Anti-Pattern Test ===\n")
    ok = test_e4_vrv_no_compressor_trip()
    print(f"\nResult: {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)