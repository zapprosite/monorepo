# REVIEW-smoke-tests-20260407

**Date:** 2026-04-07
**Reviewer:** smoke-test-runner
**Scope:** smoke-tests pipeline simulation
**Pipeline:** homelab-smoke-tests

## Summary

Simulação de 3 pipelines fictícias para testar sistema de smoke tests e review.

| Pipeline | Status | Pass | Fail | Warn |
|---|---|---|---|---|
| pipeline-whisper-gpu | ✅ PASS | 5 | 0 | 0 |
| pipeline-alerting | ⚠️ CONFLICT | 4 | 0 | 1 |
| pipeline-dns | ❌ FAIL | 3 | 1 | 0 |

---

## Findings

### CRITICAL (Must Fix)

#### DNS-002: Wrong IP for qdrant service

| Field | Value |
|---|---|
| **File** | `tasks/smoke-tests/pipeline-dns.yaml` (test spec) |
| **Test ID** | DNS-002 |
| **Severity** | CRITICAL |
| **Type** | ERROR |
| **Expected** | `10.0.1.5` |
| **Actual** | `10.0.1.10` |

**Impact:** Services cannot resolve qdrant hostname — vector search functionality broken.

**Root Cause:** CoreDNS forward rule points to wrong upstream DNS server.

**Fix Required:**
```bash
# Update /srv/apps/dns/Corefile
# Change: forward . 10.0.1.10
# To:     forward . 10.0.1.5
docker restart coredns
```

**Verification:**
```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f getent hosts qdrant
# Expected: 10.0.1.5
```

---

### WARNING (Should Fix)

#### AL-005: AlertManager reload endpoint timeout

| Field | Value |
|---|---|
| **File** | `tasks/smoke-tests/pipeline-alerting.yaml` (test spec) |
| **Test ID** | AL-005 |
| **Severity** | WARNING |
| **Type** | CONFLICT |
| **Output** | Connection timeout after 2s |
| **Expected** | HTTP 200 |

**Impact:** AlertManager config cannot be hot-reloaded — requires container restart to apply config changes.

**Fix:**
```bash
# Check if port 9093 is exposed on localhost
ss -tlnp | grep 9093

# If not exposed, update docker-compose:
# ports:
#   - "127.0.0.1:9093:9093"

# Or use docker exec to reload instead:
docker exec alertmanager kill -HUP 1
```

---

## Validation

Smoke test runner successfully:
1. ✅ Detected PASS (pipeline-whisper-gpu)
2. ✅ Detected CONFLICT with warning (pipeline-alerting)
3. ✅ Detected FAIL with critical error (pipeline-dns)
4. ✅ Generated JSON results in `tasks/smoke-tests/results/`
5. ✅ Generated this review document

---

## Recommendation

| Action | Priority | Owner |
|---|---|---|
| Fix DNS-002 (qdrant IP) | CRITICAL | infra |
| Fix AL-005 (AlertManager reload) | LOW | infra |
| Merge smoke-tests to `ubuntu-sem-teclado` | MEDIUM | will |

---

**Generated:** 2026-04-07 18:00 UTC
**Next Review:** After DNS-002 fix deployed
