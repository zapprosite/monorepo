# Rate Limiting — SPEC-040 sec.4

> **SPEC:** SPEC-040-homelab-alerting-rate-limit.md
> **Status:** IMPLEMENTED
> **Last Updated:** 2026-04-17

---

## Architecture

```
INTERNET → nginx upstream (rate limiting) → backend services
                ↓
         Per-IP limits (nginx limit_req_zone)
         Per-Key limits (LiteLLM router)
```

## Per-IP Rate Limits (nginx upstream)

| Service        | Port  | Zone        | Limit       | Burst |
| -------------- | ----- | ----------- | ----------- | ----- |
| Ollama         | 11435 | `ollama`    | 60 req/min  | 10    |
| LiteLLM Proxy  | 4010  | `litellm`   | 90 req/min  | 15    |
| Hermes Gateway | 8643  | `hermes`    | 20 req/min  | 3     |
| OpenWebUI      | 3010  | `openwebui` | 30 req/min  | 5     |
| n8n Webhooks   | 5678  | `n8n`       | 120 req/min | 20    |

**Implementation:** `docker/nginx-rate-limit/docker-compose.yml`
**Config files:** `docker/nginx-rate-limit/nginx-ratelimit-{service}.conf`
**Shared zones:** `docker/nginx-rate-limit/rate-limit.conf`

### Verify nginx rate limiting is active

```bash
# Check containers are running
docker ps --filter name=nginx-ratelimit

# Test rate limit (should return 429 after burst)
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4010/health
done
```

---

## Per-API-Key Rate Limits (LiteLLM)

> Applied at LiteLLM router level (Coolify-managed)

| Key Type | Limit        | Concurrent |
| -------- | ------------ | ---------- |
| Default  | 100 req/min  | 5          |
| Premium  | 1000 req/min | 20         |
| Internal | 500 req/min  | 10         |

### LiteLLM config.yaml (apply via Coolify)

```yaml
litellm_settings:
  num_parallel_requests: 10
  max_parallel_requests: 20

router_settings:
  redis_host: localhost
  redis_password: ${REDIS_PASSWORD}
  rpm_limit_per_user: 100
  concurrent_request_limit_per_user: 5
  # Key-specific limits via model group alias
  model_group_alias:
    premium: 'gpt-4o'
    internal: 'gpt-4o-mini'

premium_users:
  - user: premium-key-hash
    rpm_limit: 1000
    concurrent_limit: 20
```

---

## WAF Rules (nginx)

### Basic Security Headers

```nginx
# Add to each nginx-ratelimit-*.conf inside server {} block
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Block Suspicious Requests

```nginx
# Block SQL injection
if ($query_string ~ "*union*select*") { return 403; }
if ($query_string ~ "*union*insert*") { return 403; }
if ($query_string ~ "concat.*\(") { return 403; }

# Block path traversal
if ($uri ~ "\.\./") { return 403; }
if ($uri ~ "\.\.\/) { return 403; }

# Block known malicious patterns
if ($request_uri ~ "<script") { return 403; }
if ($request_uri ~ "eval\(") { return 403; }
```

### Geographic Allowlist (Traefik label approach)

For Traefik-managed services, add label:

```yaml
labels:
  traefik.http.middlewares.ratelimit.headers.geographicallow: '*'
```

---

## GPU Budget (RTX 4090 — 24GB VRAM)

| Service             | VRAM Reserved | Max Concurrent | Limit      |
| ------------------- | ------------- | -------------- | ---------- |
| Ollama (Qwen2.5 7B) | 14GB          | 2              | 60 req/min |
| LiteLLM Proxy       | 4GB           | 4              | 90 req/min |
| wav2vec2 STT        | 2GB           | 1              | 30 req/min |
| Kokoro TTS          | 1GB           | 1              | 30 req/min |
| **Buffer**          | 3GB           | -              | -          |

---

## Alerts

```yaml
# Prometheus alert — rate limit triggered
- alert: RateLimitThrottled
  expr: nginx_http_requests_total{status="429"} > 10
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: 'Rate limit throttling on {{ $labels.service }}'
```

---

## References

- SPEC-040: `docs/SPECS/SPEC-040-homelab-alerting-rate-limit.md`
- nginx rate limiting: `docker/nginx-rate-limit/`
- LiteLLM docs: [pytorch.org/litellm](https://docs.litellm.ai)
