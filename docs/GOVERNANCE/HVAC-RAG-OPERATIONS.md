# HVAC RAG Operations Runbook

**Service:** HVAC RAG Pipe — Zappro Clima Tutor
**Version:** 2.0.0
**Public Model:** zappro-clima-tutor
**Status:** Pilot Ready (Internal / Supervised Technical Use Only)
**Last Updated:** 2026-04-28

---

## Overview

The HVAC RAG system provides a friendly tutor-style assistant for field technicians working on HVAC inverter equipment. It combines a Qdrant vector database (context/evidence), an internal diagnostic graph, and MiniMax M2.7 as the **primary writing engine**. A Juiz pre-flight validator protects the system.

**Architecture principle:** RAG provides evidence. MiniMax writes the answer. The friendly response rewriter is the final safety net.

```
User Query → Juiz (validate)
              ↓
         Router (what mode?)
              ↓
         guided_triage  →  Qdrant (top_k=6)  →  MiniMax M2.7  →  Friendly Rewriter  →  Response
         field_tutor    →  Qdrant (top_k=10) →  MiniMax M2.7  →  Friendly Rewriter  →  Response
         printable      →  Qdrant + Formatter →  Plain text
              ↓
         No manual?  →  Graph internal / Web search (controlled fallback)
```

**Public model exposed:** `zappro-clima-tutor` (only model in `/v1/models`)

**IMPORTANT:** This system is for **internal technical use only**. Do not expose to end customers without a burn-in period.

---

## Architecture

```
OpenWebUI (default model: zappro-clima-tutor)
    └── hvac-rag-pipe.py (port 4017, v2.0.0)
            ├── Juiz (regex pre-flight, <50ms)
            ├── Router (printable / guided_triage / field_tutor)
            ├── Qdrant hvac_manuals_v1 (context/evidence)
            ├── Ollama (nomic-embed-text embeddings)
            ├── MiniMax M2.7 (primary writing engine — NOT raw RAG output)
            └── Friendly Response Rewriter (tone safety net)
```

### Public vs Internal

| Exposto em `/v1/models` | Interno (urls, não exposto) |
|---|---|
| `zappro-clima-tutor` | `hvac-manual-strict`, `hvac-field-tutor`, `hvac-printable` |

### Endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Health check (v2.0.0, shows public_model) | None |
| `GET /v1/models` | Lista só `zappro-clima-tutor` | None |
| `POST /v1/chat/completions` | Tutor friendly (default router) | Via OpenWebUI |
| `POST /v1/chat/completions/field-tutor` | Técnico de campo, contexto expandido | Via OpenWebUI |
| `POST /v1/chat/completions/printable` | Texto plano para impressora térmica | Via OpenWebUI |

### Unified Status

```bash
# Single command for full pipeline status
python3 scripts/hvac-rag/hvac-status.py
python3 scripts/hvac-rag/hvac-status.py --compact
python3 scripts/hvac-rag/hvac-status.py --json
```

---

## Healthcheck

Run the periodic health verification:

```bash
# Run healthcheck
python /srv/monorepo/scripts/hvac-rag/hvac-healthcheck.py

# Check last report
cat /tmp/hvac-healthcheck.json

# Exit code: 0 = all pass, 1 = any fail
```

### Healthcheck Checks

1. `/health` endpoint responds
2. `/v1/models` returns model list
3. Juiz validation (synthetic HVAC query, pure regex)
4. Qdrant `hvac_manuals_v1` collection accessible
5. Sample query to `/v1/chat/completions/field-tutor`
6. Sample query to `/v1/chat/completions/printable`

### Scheduling

Add to crontab for periodic checks:

```bash
# Every 15 minutes
*/15 * * * * /usr/bin/python3 /srv/monorepo/scripts/hvac-rag/hvac-healthcheck.py >> /var/log/hvac-healthcheck.log 2>&1

# Every day at 07:00
0 7 * * * /usr/bin/python3 /srv/monorepo/scripts/hvac-rag/hvac-daily-smoke.py >> /var/log/hvac-daily-smoke.log 2>&1
```

---

## Daily Smoke Test

Run the T015.2 evaluation suite:

```bash
# Run daily smoke test
python /srv/monorepo/scripts/hvac-rag/hvac-daily-smoke.py

# Custom report path
python /srv/monorepo/scripts/hvac-rag/hvac-daily-smoke.py --report /tmp/smoke-$(date +%Y%m%d).json

# Check last report
cat /tmp/hvac-daily-smoke-$(date +%Y%m%d).json
```

### Smoke Test Categories

| Category | Count | Expected Behavior |
|---|---|---|
| Positive HVAC queries | 5 | Juiz: APPROVED, response served |
| Out-of-domain queries | 5 | Juiz: BLOCKED |
| Ask-clarification queries | 3 | Juiz: ASK_CLARIFICATION |
| Printable assertions | 2 | Plain text output, no markdown |

### Smoke Test Exit Codes

- `0`: All assertions pass
- `1`: Any assertion fails

### Friendly Tutor UX Tests

```bash
# UX validation (requires pipe running)
python /srv/monorepo/smoke-tests/smoke_hvac_friendly_tutor_ux.py

# Tests:
# - Only zappro-clima-tutor in /v1/models
# - No "Graph interno" in responses
# - Max one question at the end
# - U4-01 friendly response
# - IPM/alalta tensão safety maintained
# - Out-of-domain blocked
```

### Friendly Response Rewriter

The `hvac-friendly-response.py` module is the tone safety net — applied after every MiniMax response:

```bash
# Test rewrite rules
python3 scripts/hvac-rag/hvac-friendly-response.py --test
```

Rules (4/4 must PASS):
1. `"Graph interno"` / `"Evidência:"` → removed or replaced with `"Pela triagem técnica"`
2. Dry procedural opener → friendly version
3. `"Confirma uma coisa simples: forneça o MODELO COMPLETO"` → friendly ask
4. Dead end `"não encontrei no manual"` → triagem técnica fallback

---

## Observability Reports

### Report Locations

| Report | Default Path |
|---|---|
| Healthcheck | `/tmp/hvac-healthcheck.json` |
| Daily Smoke | `/tmp/hvac-daily-smoke-YYYYMMDD.json` |
| Burn-in | `/srv/monorepo/manifests/spec-hvac-004-burnin-YYYYMMDD.json` |

### Report Fields (No Raw Data)

All reports use query hashes (SHA256 prefix) instead of raw query text:

```
query_hash: "a3f7c2d9"  # SHA256 first 8 chars of original query
judge_result: "APPROVED"
fallback_used: false
latency_ms: 234
```

---

## Alert Thresholds

| Metric | Warning | Critical |
|---|---|---|
| Healthcheck failures | Any single check fails | 2+ consecutive failures |
| Fallback rate | > 5% per day | > 20% per day |
| Juiz BLOCKED rate | > 80% (possible attack) | > 95% |
| Latency (p95) | > 5000ms | > 10000ms |
| Qdrant collection points | < 400 | < 300 |

---

## LiteLLM Fallback Behavior

When LiteLLM is unavailable, the pipe returns a **safe fallback response**:

- If context was retrieved: Returns context with "model unavailable" message
- If no context: Returns "model unavailable, try again later"
- Fallback responses are marked with `"fallback": true` in JSON

**Do not show raw error messages to users in fallback mode.**

---

## Juiz Validation Rules

### APPROVED
- Query contains HVAC components, error codes, or model patterns
- No out-of-domain terms detected
- Model information is complete enough

### BLOCKED
- Query contains out-of-domain terms (refrigerator, TV, car, etc.)
- Juiz detected request for invented values

### ASK_CLARIFICATION
- Model is incomplete (e.g., "split" without full model number)
- Juiz cannot proceed without complete model information

---

## Burn-in Procedure

Before moving to production:

1. Run healthcheck for 7 consecutive days
2. Collect 20-30 real queries from technical staff
3. Record per-query:
   - Query hash
   - Endpoint used
   - Juiz result
   - Whether fallback was used
   - Whether human correction was needed
4. Calculate:
   - Fallback rate
   - Out-of-domain block rate
   - ASK_CLARIFICATION rate
   - User satisfaction (if tracked)

See: `manifests/spec-hvac-004-burnin-template.json`

---

## Incident Response

### Pipe Down

```bash
# Check if process is running
ps aux | grep hvac-rag-pipe

# Check logs
journalctl -u hvac-rag-pipe --since "1 hour ago"

# Restart (if using systemd)
sudo systemctl restart hvac-rag-pipe
```

### Qdrant Down

```bash
# Check Qdrant status
curl http://127.0.0.1:6333/

# Check collection
curl -H "Authorization: Bearer $QDRANT_API_KEY" \
  http://127.0.0.1:6333/collections/hvac_manuals_v1
```

### LiteLLM Down

```bash
# Check LiteLLM
curl http://127.0.0.1:4000/health

# Check models
curl -H "Authorization: Bearer $LITELLM_API_KEY" \
  http://127.0.0.1:4000/v1/models
```

---

## Rollback

If issues are detected after update:

```bash
# Stop current pipe
pkill -f hvac-rag-pipe

# Revert to previous version
cd /srv/monorepo
git checkout HEAD~1 -- scripts/hvac-rag/hvac-rag-pipe.py

# Restart
python3 scripts/hvac-rag/hvac-rag-pipe.py &
```

---

## Contacts

| Role | Responsibility |
|---|---|
| Platform Engineering | Infrastructure, deployments |
| HVAC Technical Lead | Query quality, manual updates |
| AI Governance | Compliance, safety review |

---

## References

- SPEC-HVAC-004: `docs/SPECS/products/HVAC/SPEC-HVAC-004-juiz-field-tutor.md`
- Canonical answer template: `config/hvac-copilot/answer-template-ptbr.md`
- Public model profile: `config/hvac-copilot/zappro-clima-tutor.yaml`
- Friendly response rewriter: `scripts/hvac-rag/hvac-friendly-response.py`
- Unified status: `scripts/hvac-rag/hvac-status.py`
- Simplification audit: `docs/AUDITS/HVAC-RAG-SIMPLIFICATION-AUDIT-2026-04.md`
- Evaluation Report: `manifests/spec-hvac-004-runtime-reliability-report.json`
- Qdrant Collection: `hvac_manuals_v1` (442 points)
- LiteLLM: `http://127.0.0.1:4000`
- Ollama: `http://127.0.0.1:11434`
- MiniMax M2.7: primary answer model (via LiteLLM)
