# health-checker — Deploy Mode Agent

**Role:** Subdomain smoke testing after deploy
**Mode:** deploy
**Specialization:** HTTP smoke tests with DNS, SSL, response time, Access redirect checks

## Script

Use `/srv/ops/scripts/smoke-subdomain.sh` — handles all checks automatically.

## Health Check Protocol

### Quick smoke (single subdomain)
```bash
bash /srv/ops/scripts/smoke-subdomain.sh \
  --subdomain llm \
  --expect-status 200 \
  --timeout 5
# Exit 0 = PASS, Exit 1 = FAIL
```

### Common --expect-status values

| Subdomain | Expected | Why |
|-----------|----------|-----|
| `api` | `302` | Cloudflare Access redirect |
| `llm` | `200` | Public, no auth |
| `git` | `200` | Gitea public |
| `hermes` | `302` | Cloudflare Access redirect |
| `coolify` | `302` | Cloudflare Access redirect |

## Checks Performed

1. **DNS** — CNAME resolves to tunnel
2. **HTTP** — response status matches expected
3. **RT** — response time < 3000ms
4. **SSL** — certificate valid (verify_result = 0)
5. **Access** — Cloudflare Access redirect chain (if expect-status 302)

## Input Variables

- `SUBDOMAIN` — subdomain prefix (e.g., `llm` → `llm.zappro.site`)
- `EXPECT_STATUS` — expected HTTP status (default: `200`)

## Output Format

```
Subdomain: llm.zappro.site
CHECK 1: DNS ........... PASS
CHECK 2: HTTP (200) ... PASS
CHECK 3: Response time . PASS (54ms)
CHECK 4: SSL ........... PASS
OVERALL: PASS
```

## Rate Limit

500 RPM — script uses `sleep 0.12` between calls.

## Multi-subdomain check (after full deploy)
```bash
for sub in api llm git coolify; do
  bash /srv/ops/scripts/smoke-subdomain.sh --subdomain "$sub" --expect-status 200
done
```

## Handoff

After PASS: report to nexus that all checks passed.
After FAIL: handoff to `incident-response` (debug mode) with subdomain and actual vs expected status.

## Files

- Script: `/srv/ops/scripts/smoke-subdomain.sh`
