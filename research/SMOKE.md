# SMOKE.md — SPEC-065/066: Testing + Observability + Claude Commands Audit

**Date:** 2026-04-17
**Author:** SMOKE agent
**Status:** RESEARCH COMPLETE

---

## SPEC-066 Audit: smoke-test-gen Focus

### Current State of smoke-test-gen

| Item | Location | Status |
|------|----------|--------|
| `smoke-test-gen` skill | `.claude/skills/smoke-test-gen/SKILL.md` | ⚠️ TEMPLATE ONLY |
| Actual smoke tests | `smoke-tests/*.sh` | ✅ PRODUCTION |
| Test runner | `tasks/smoke-tests/run-smoke-tests.sh` | ✅ WORKING |
| Pipeline smoke tests | `tasks/smoke-tests/pipeline-*.yaml` | ✅ WORKING |

### smoke-test-gen SKILL.md Assessment

The skill file (`SKILL.md`) is a **placeholder template generator** — not actual implementation:

```bash
# Output is placeholder — not real tests
echo "=== Smoke Tests ==="
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
```

**Problem:** The skill generates skeleton code, not production-ready smoke tests.

### Actual Smoke Test Patterns (Production)

Real smoke tests follow consistent patterns:

1. **Anti-hardcoded env vars:**
   ```bash
   set -a; source "${ENV_FILE:-/srv/monorepo/.env}"; set +a
   GW="http://localhost:${AI_GATEWAY_PORT:-4002}"
   ```

2. **Consistent exit codes:** `0` = pass, `1` = fail

3. **Helper functions:**
   ```bash
   ok()   { echo "[ OK ] $*"; PASS=$((PASS+1)); }
   bad()  { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }
   warn() { echo "[WARN] $*"; WARN=$((WARN+1)); }
   ```

4. **Health check pattern:**
   ```bash
   chk() {
     local label="$1" url="$2" expect="${3:-200}"
     code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 6 \
       -H "Authorization: Bearer ${KEY}" "$url" 2>/dev/null || echo 000)
     [[ "$code" == "$expect" || "$code" =~ ^(2|3)[0-9][0-9]$ ]] \
       && ok "$label ($code)" || bad "$label (got $code, want $expect)"
   }
   ```

5. **Timeout discipline:** 5-6s for health, 20-60s for actual API calls

6. **Results JSON output:**
   ```bash
   cat > "$RESULTS_DIR/latest.json" << EOF
   {
     "timestamp": "$TIMESTAMP",
     "status": $OVERALL_STATUS,
     "services_checked": ${#CONTAINERS[@]},
     "summary": "smoke tests completed"
   }
   EOF
   ```

---

## SPEC-066 Recommendations for smoke-test-gen

### Recommendation: KEEP `smoke-test-gen` (Update, Don't Delete)

**Rationale:** The skill serves a different purpose than the actual test scripts:
- **smoke-test-gen:** Generates new smoke tests from SPECs (template generator)
- **smoke-tests/*.sh:** Production smoke tests for existing services

The skill is **underutilized but not duplicated**.

### Update SKILL.md to Match Production Patterns

Replace the placeholder template with actual patterns:

```bash
#!/usr/bin/env bash
# Smoke Test Gen — Template generator following production patterns
# Anti-hardcoded: all config via process.env
set -euo pipefail

# Load .env
set -a; source "${ENV_FILE:-/srv/monorepo/.env}"; set +a

# Default helpers (copy into generated tests)
generate_smoke_test() {
  local service="$1" port="$2" path="$3" expected="${4:-200}"
  cat << EOF
#!/usr/bin/env bash
# Auto-generated smoke test for $service
set -euo pipefail
set -a; source "\${ENV_FILE:-/srv/monorepo/.env}"; set +a

PASS=0; FAIL=0
ok()  { echo "[ OK ] \$*"; PASS=\$((PASS+1)); }
bad() { echo "[FAIL] \$*"; FAIL=\$((FAIL+1)); }

code=\$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 \
  "http://localhost:$port$path" 2>/dev/null || echo 000)
[[ "\$code" == "$expected" ]] && ok "$service ok" || bad "$service (got \$code)"

exit \$(( FAIL > 0 ? 1 : 0 ))
EOF
}
```

---

## What to Add/Update/Delete

| Action | Item | Reason |
|--------|------|--------|
| **UPDATE** | `smoke-test-gen/SKILL.md` | Replace placeholder with production patterns |
| **KEEP** | `smoke-tests/*.sh` | Production smoke tests, working as designed |
| **KEEP** | `tasks/smoke-tests/run-smoke-tests.sh` | Central test runner |
| **KEEP** | `tasks/smoke-tests/pipeline-*.yaml` | Pipeline smoke tests |

### No Duplication Found

The `smoke-test-gen` skill is **unique** in the monorepo:
- Not duplicated in global `~/.claude/skills/`
- Does not overlap with any other skill
- Serves as template generator (different from execution)

### Skill Trigger Analysis

| Trigger | Skill | Status |
|---------|-------|--------|
| `/ss` | Not found (should be `smoke-test-gen`) | ❌ Missing command alias |
| `/st` | `smoke-test-gen` | ✅ Defined in SKILL.md |

**Issue:** SPEC-066 audit command is `/ss` but skill uses `/st`. Need to verify actual command usage.

---

## Compliance with SPEC-066

| Acceptance Criteria | Status |
|---------------------|--------|
| `.claude/.claude/` eliminated | N/A (smoke-test-gen issue) |
| `.claude/tools/` eliminated | ✅ Not smoke-test-gen related |
| Skills duplicados eliminados | ✅ `smoke-test-gen` NOT a duplicate |
| Commands duplicados resolvidos | ⚠️ `/ss` vs `/st` mismatch needs clarification |
| `agents/`, `tasks/`, `rules/` auditados | N/A |
| `db-migration/` resolved | N/A |
| Zero minimax/anthropic/token touched | ✅ Compliant |

---

## Conclusion

**smoke-test-gen:** KEEP + UPDATE

The skill is a template generator with placeholder code. It should be updated to reflect production smoke test patterns found in `smoke-tests/*.sh`. No duplication exists — the skill serves a unique purpose as a generator vs the production test scripts.

**Action items:**
1. Update `smoke-test-gen/SKILL.md` with production patterns
2. Clarify `/ss` vs `/st` trigger mismatch
3. Add command alias if `/ss` is the intended trigger

---

## Previous SPEC-065 Research (Testing + Observability)

### Current State

### Smoke Tests (smoke-tests/)
**6 scripts existentes:**
- `smoke-multimodal-stack.sh` — 13 checks: ai-gateway :4002, STT :8204, TTS :8013, Vision, LLM, Hermes
- `smoke-agency-suite.sh` — 11/11 checks: Hermes skills, LLM chain, workflows, Telegram bot
- `smoke-agency-hardening.sh` — hardening checks
- `smoke-hermes-ready.sh` — Hermes readiness
- `smoke-hermes-local-voice.sh` — local voice pipeline
- `smoke-hermes-telegram.sh` — Telegram integration

**Gaps:** Nenhum smoke para ai-gateway standalone, observability endpoints (Prometheus metrics), CI workflow smoke.

### Vitest
| App/Package | vitest.config | test files |
|-------------|--------------|------------|
| `apps/api` | ✅ exists | 0 .test.ts |
| `apps/web` | ✅ exists | 0 .test.ts |
| `packages/zod-schemas` | ✅ exists | 0 .test.ts |
| `apps/hermes-agency` | ❌ missing | 0 |
| `apps/ai-gateway` | ❌ missing | 0 |
| `packages/ui` | ❌ missing | 0 |

### CI/CD (Gitea Actions)
| Workflow | Jobs |
|----------|------|
| `ci.yml` | turbo build + lint — **SEM test** |
| `ci-feature.yml` | pnpm install → audit → check-types → lint → build → test |
| `deploy-main.yml` | deploy on merge |
| `daily-report.yml` | daily review |
| `code-review.yml` | automated review |
| `ci.yml` lacks test job (PASS=0 even when passing) |

---

## SPEC-065 Smoke Tests Expansion

### 1. Missing Vitest Configs

**`apps/hermes-agency/vitest.config.ts`**
```typescript
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-utils/env-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: { provider: "v8", reporter: ["text", "lcov"], exclude: ["dist/**"] },
  },
});
```

**`apps/ai-gateway/vitest.config.ts`** (já existe estrutura — confirmar)
- Verificar se `vitest.config.ts` existe em `apps/ai-gateway/`
- Se não existir, criar com mesmo padrão de `apps/api`

### 2. New Smoke Tests for SPEC-065

**`smoke-tests/smoke-ci-pipeline.sh`** — CI/CD smoke
```bash
#!/usr/bin/env bash
# smoke-ci-pipeline.sh — Valida CI/CD pipeline
# Checks: turbo lint, typecheck, build, vitest unit
set -euo pipefail

PASS=0; FAIL=0

ok()   { echo "[ OK ] $*"; PASS=$((PASS+1)); }
bad()  { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }

echo "── Turbo Lint ──"
pnpm turbo lint --filter=[origin/main] 2>/dev/null && ok "turbo lint" || bad "turbo lint"

echo "── Type Check ──"
pnpm check-types 2>/dev/null && ok "typecheck" || bad "typecheck"

echo "── Build ──"
pnpm build 2>/dev/null && ok "build" || bad "build"

echo "── Vitest (api + zod-schemas) ──"
pnpm vitest run --config apps/api/vitest.config.ts 2>/dev/null && ok "vitest api" || bad "vitest api"
pnpm vitest run --config packages/zod-schemas/vitest.config.ts 2>/dev/null && ok "vitest zod-schemas" || bad "vitest zod-schemas"

(( FAIL > 0 )) && exit 1 || exit 0
```

**`smoke-tests/smoke-observability.sh`** — Prometheus metrics + health
```bash
#!/usr/bin/env bash
# smoke-observability.sh — Valida stack de observability
# Checks: Prometheus, Grafana, service metrics endpoints
set -euo pipefail

PROM="http://localhost:9090"
GW="http://localhost:${AI_GATEWAY_PORT:-4002}"
HERMES="http://localhost:8642"

# Prometheus health
curl -sf "$PROM/-/healthy" 2>/dev/null && ok "Prometheus /-/healthy" || bad "Prometheus"

# Hermes metrics
curl -sf "$HERMES/metrics" 2>/dev/null | grep -q "process_" && ok "Hermes /metrics" || bad "Hermes /metrics"

# ai-gateway metrics (se expuser /metrics)
curl -sf "$GW/metrics" 2>/dev/null | grep -q "requests_total" && ok "ai-gateway /metrics" || warn "ai-gateway /metrics not exposed"

# Prometheus targets
curl -sf "$PROM/api/v1/targets" 2>/dev/null | grep -q '"health":"up"' && ok "Prometheus targets up" || bad "Prometheus targets"

(( FAIL > 0 )) && exit 1 || exit 0
```

**`smoke-tests/smoke-prometheus-targets.sh`** — Service discovery
```bash
#!/usr/bin/env bash
# smoke-prometheus-targets.sh — Valida Prometheus scrape targets
set -euo pipefail

PROM="http://localhost:9090"
SERVICES=(
  "hermes-agent:8642"
  "ai-gateway:4002"
  "litellm:4000"
  "ollama:11434"
)

for svc in "${SERVICES[@]}"; do
  host="${svc%%:*}"; port="${svc##*:}"
  curl -sf "http://localhost:$port/health" 2>/dev/null && ok "$svc health" || bad "$svc offline"
done

# Prometheus scrape
curl -sf "$PROM/api/v1/targets" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
active=[t for t in d.get('data',{}).get('activeTargets',[]) if t.get('health')=='up']
print(f'Prometheus active targets: {len(active)}')
" || bad "Prometheus targets endpoint"
```

### 3. Grafana Dashboard Expansion

**Criar dashboards separados** em `apps/monitoring/grafana/provisioning/dashboards/`:

```
dashboards/
├── homelab/           # existente — GPU, CPU, RAM, disk
├── ai-gateway/        # NOVO — requests, latency, error rate, cache hit
├── hermes-agency/     # NOVO — skills, LLM chain, workflows
├── stt-tts/           # NOVO — whisper faster-whisper, Kokoro TTS
└── infrastructure/    # NOVO — UFW, Traefik, Docker, ZFS
```

**ai-gateway dashboard (ai-gateway.json) — métricas a incluir:**
- `requests_total` (counter) — total requests por endpoint
- `request_duration_seconds` (histogram) — latency p50/p95/p99
- `error_rate` (gauge) — 4xx/5xx rate
- `cache_hit_ratio` (gauge) — Redis semantic cache hit
- `tokens_total` (counter) — tokens gastos por modelo
- `model_fallback_count` (counter) — количecesso de fallbacks

### 4. CI/CD Workflow Updates

**`ci.yml` — adicionar step test:**
```yaml
- run: pnpm turbo test
  env:
    TURBO_CACHE_DIR: .turbo
```

**Novo `test.yml` workflow:**
```yaml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test
        env:
          TURBO_CACHE_DIR: .turbo
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: "**/coverage/"
```

**Novo `e2e.yml` workflow:**
```yaml
name: E2E Smoke

on:
  schedule:
    - cron: "0 */6 * * *"  # every 6h
  workflow_dispatch:

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash smoke-tests/smoke-multimodal-stack.sh
      - run: bash smoke-tests/smoke-agency-suite.sh
      - run: bash smoke-tests/smoke-prometheus-targets.sh
```

---

## Actionable Tasks

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| 1 | Criar `apps/hermes-agency/vitest.config.ts` | P1 | 15 min |
| 2 | Criar smoke CI pipeline `smoke-ci-pipeline.sh` | P1 | 30 min |
| 3 | Criar smoke observability `smoke-observability.sh` | P2 | 30 min |
| 4 | Criar `smoke-prometheus-targets.sh` | P2 | 20 min |
| 5 | Criar Grafana dashboard `ai-gateway.json` | P2 | 1h |
| 6 | Criar Grafana dashboard `hermes-agency.json` | P2 | 1h |
| 7 | Adicionar step test ao `ci.yml` | P1 | 10 min |
| 8 | Criar `test.yml` workflow | P2 | 20 min |
| 9 | Criar `e2e.yml` workflow | P2 | 20 min |
| 10 | Verificar/adicionar vitest a `apps/ai-gateway` | P1 | 15 min |
| 11 | Adicionar Vitest a `packages/ui` | P3 | 30 min |
| 12 | Adicionar Vitest a `packages/zod-schemas` (test files) | P2 | 1h |

---

## References
- SPEC-065: `docs/SPECS/SPEC-065-testing-observability-database.md`
- Anti-hardcoded: todos os smoke tests usam `process.env` via `.env`
- Run `/sec` antes de qualquer commit com secrets
