# HVAC RAG Operations Runbook

**Service:** HVAC RAG Pipe
**Version:** 1.0.0
**Status:** Pilot Ready (Internal / Supervised Technical Use Only)
**Last Updated:** 2026-04-28

---

## Overview

The HVAC RAG system provides technical assistance for field technicians working on HVAC inverter equipment. It combines a Qdrant vector database with LiteLLM for natural language queries, protected by a Juiz pre-flight validator.

```
User Query → Juiz (validate) → Qdrant (search) → Field Tutor / Printable → LiteLLM → Response
                    ↓
              Block if out-of-domain
              Ask if model incomplete
```

**IMPORTANT:** This system is for **internal technical use only**. Do not expose to end customers without a burn-in period.

---

## Architecture

```
OpenWebUI
    └── hvac-rag-pipe.py (port 4017)
            ├── Juiz (regex pre-flight validation)
            ├── Qdrant hvac_manuals_v1 (442 points)
            ├── Ollama (nomic-embed-text embeddings)
            └── LiteLLM (model inference)
```

### Endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Health check | None |
| `GET /v1/models` | List available models | None |
| `POST /v1/chat/completions` | Standard RAG query | Via OpenWebUI |
| `POST /v1/chat/completions/field-tutor` | Expanded context with procedures | Via OpenWebUI |
| `POST /v1/chat/completions/printable` | Plain text for thermal printer | Via OpenWebUI |

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
- Evaluation Report: `manifests/spec-hvac-004-runtime-reliability-report.json`
- Qdrant Collection: `hvac_manuals_v1` (442 points)
- LiteLLM: `http://127.0.0.1:4000`
- Ollama: `http://127.0.0.1:11434`
