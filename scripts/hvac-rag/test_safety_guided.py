#!/usr/bin/env python3
"""Safety + Guided Triage interaction tests."""
import sys, os, importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def import_local(name, f):
    spec = importlib.util.spec_from_file_location(name, os.path.join(SCRIPT_DIR, f))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

_juiz = import_local("juiz", "hvac-juiz.py")
judge = _juiz.judge
JuizResult = _juiz.JuizResult

tests = [
    # safety + guided_triage cases
    ("ipm erro e4 vrv daikin", "GUIDED_TRIAGE", "should be guided even with safety keyword"),
    ("alta tensão vrv carrier e3", "GUIDED_TRIAGE", "should be guided with safety kw"),
    ("capacitor e4 vrv daikin", "GUIDED_TRIAGE", "capacitor is safety but still guided"),

    # safety with complete model - should be APPROVED not guided
    ("RXYQ20BRA ipm erro e4", "APPROVED", "has model, safety kw, should be approved"),
]

print("=== Safety + Guided Triage Tests ===\n")
for query, expected, desc in tests:
    result, meta = judge(query)
    if result.value == expected:
        print(f"✅ {query[:40]}: {result.value} ({desc})")
    else:
        print(f"❌ {query[:40]}: expected {expected}, got {result.value}")
        print(f"   reason={meta.get('reason')} safety_kw={meta.get('has_safety_keywords')} complete_model={meta.get('has_complete_model')}")