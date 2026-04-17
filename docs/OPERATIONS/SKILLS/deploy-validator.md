# Skill: deploy-validator

> **Versão:** 1.0.0
> **Data:** 2026-04-08
> **Autor:** will + Claude Code
> **Tags:** `deploy`, `validation`, `smoke-test`, `zfs`, `rollback`, `pipeline`, `ci-cd`, `gitea-actions`

## Descrição

Validação completa de deploy para o homelab — executa ZFS snapshot, verificação de container health, network connectivity, routing e smoke test do voice pipeline. Designado para prevenir os incidentes documentados em `INCIDENT-2026-04-08-voice-pipeline-stable.md`.

Segue as 6 fases do Prevention Master Plan daquele incidente:

| Phase | Foco | Anti-Pattern Prevenido |
|-------|------|------------------------|
| 1 | ZFS Snapshot | Catastrophic rollback |
| 2 | Container Health | AP-3: Health check sem rota funcional |
| 3 | Network Connectivity | AP-1: Host process como backend, AP-2: testar só do host |
| 4 | Routing Verification | AP-4: DNS/Tunnel UP != Service UP |
| 5 | Smoke Test | Falha silenciosa de deploy |
| 6 | Rollback Trigger | Recovery quando smoke test falha |

---

## Metadata

```yaml
name: deploy-validator
description: Pre-deploy health validation — ZFS snapshot, container health, network, routing, smoke test, rollback
complexity: medium
risk: medium
timeout: 300s
entry_point: docs/OPERATIONS/SKILLS/deploy-validator.sh
prerequisites:
  - docker
  - zfs (tank pool)
  - curl, nslookup, python3
  - LITELLM_KEY, MINIMAX_API_KEY (for smoke test)
uses:
  - CLI (human operator)
  - CI/CD (Gitea Actions)
```

---

## Prerequisites

```bash
# ============================================================
# PREREQUISITE CHECKS — run before starting validation
# ============================================================

# 0. Source environment variables (tokens/secrets from .env)
cd /srv/monorepo
if [[ -f .env ]]; then
    # shellcheck source=/dev/null
    source .env
fi

# 1. ZFS pool exists and is healthy
zpool status tank
# Expected: tank state: ONLINE

# 2. Docker is running
docker ps
# Expected: list of running containers

# 3. Smoke test dependencies (from .env or shell environment)
[ -n "$LITELLM_KEY" ]    || echo "WARN: LITELLM_KEY not set — some tests will be skipped"
[ -n "$MINIMAX_API_KEY" ] || echo "WARN: MINIMAX_API_KEY not set — some tests will be skipped"

# 4. Smoke test script exists
[ -f "tasks/smoke-tests/pipeline-Hermes Agent-voice.sh" ] \
    || echo "ERROR: Smoke test script not found"
```

---

## PHASE 1: Pre-Deploy ZFS Snapshot

### Procedure

```bash
# 1. Generate snapshot name
SNAPSHOT_NAME="tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)-deploy"

# 2. Create snapshot (recursive for all datasets)
sudo zfs snapshot -r "$SNAPSHOT_NAME"

# 3. Verify created
zfs list -t snapshot | grep "pre-$(date +%Y%m%d)" | tail -5
```

### Expected Output

```
NAME                                USED  REFER  MOUNTPOINT
tank@pre-20260408-143022-will-deploy  0      -  -
```

### Anti-Pattern Prevenido

**AP-0: No snapshot before structural change** — sem snapshot, rollback para estado known-good é impossível se o deploy quebrar.

### Rollback Reference

Se o deploy falhar, o snapshot criado nesta fase é o ponto de retorno.

```bash
# IDENTIFICAR SNAPSHOT
zfs list -t snapshot | grep "pre-$(date +%Y%m%d)" | grep "$(whoami)-deploy"

# FORMATO DO NOME: tank@pre-YYYYMMDD-HHMMSS-username-deploy

# EXEMPLO: tank@pre-20260408-143022-will-deploy
#              └─ nome exato a usar no rollback abaixo
```

### Acceptance Criteria

- [ ] `zfs snapshot -r` exit code = 0
- [ ] Snapshot visível em `zfs list -t snapshot`
- [ ] Nome segue formato: `tank@pre-YYYYMMDD-HHMMSS-username-deploy`

---

## PHASE 2: Container Health Verification

### Procedure

Para cada container que deve estar deployed, verificar:

```bash
# ============================================================
# 2.1 Container is running (not just "created")
# ============================================================
docker ps --filter "name=Hermes Agent" --format "{{.Names}} {{.Status}}"
# Expected: Hermes Agent-qgtzrmi6771lt8l7x8rqx72f Up (healthy) X minutes

# ============================================================
# 2.2 Container is healthy (not restarting, not exited)
# ============================================================
docker inspect Hermes Agent-qgtzrmi6771lt8l7x8rqx72f \
    --format '{{.State.Health.Status}}' 2>/dev/null || echo "no health check"
# Expected: healthy

# ============================================================
# 2.3 Container internal health endpoint
# ============================================================
docker exec Hermes Agent-qgtzrmi6771lt8l7x8rqx72f \
    curl -sf -m 5 "http://127.0.0.1:8080/healthz"
# Expected: exit 0 (no output means healthy)

# ============================================================
# 2.4 All critical containers list
# ============================================================
CRITICAL_CONTAINERS="
Hermes Agent-qgtzrmi6771lt8l7x8rqx72f
zappro-litellm
zappro-wav2vec2
coolify-proxy
"

for container in $CRITICAL_CONTAINERS; do
    STATUS=$(docker ps --filter "name=$container" --format "{{.Status}}" 2>/dev/null)
    if echo "$STATUS" | grep -q "^Up"; then
        echo "✅ $container: $STATUS"
    else
        echo "❌ $container: NOT RUNNING (status: $STATUS)"
    fi
done
```

### Anti-Pattern Prevenido

**AP-3: Health check sem verificação de rota** — `docker ps` mostra "Up" mas o container pode não estar realmente a responder no endpoint.

**ERRADO:**
```bash
docker ps | grep Hermes Agent  # "está a correr" → "está tudo bem"
```

**CERTO:**
```bash
docker exec Hermes Agent-... curl -sf -m 5 "http://127.0.0.1:8080/healthz"
```

### Acceptance Criteria

- [ ] `docker ps` shows "Up" (not "Created", not "Exited")
- [ ] `docker inspect` health status = healthy (or no health check defined)
- [ ] Internal health endpoint returns 200/0 within 5s
- [ ] All critical containers are running

---

## PHASE 3: Network Connectivity Check

### Procedure

```bash
# ============================================================
# 3.1 Check shared network between Traefik and service
# ============================================================
check_shared_network() {
    local container_a="$1"; local container_b="$2"

    local nets_a nets_b shared
    nets_a=$(docker inspect "$container_a" \
        --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" || echo "")
    nets_b=$(docker inspect "$container_b" \
        --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" || echo "")

    shared=""
    for net in $nets_a; do
        if echo "$nets_b" | grep -q "$net"; then
            shared="$net"; break
        fi
    done

    if [ -n "$shared" ]; then
        echo "✅ $container_a ↔ $container_b share network: $shared"
        return 0
    else
        echo "❌ $container_a ↔ $container_b NETWORK ISOLATED!"
        echo "   $container_a networks: $nets_a"
        echo "   $container_b networks: $nets_b"
        return 1
    fi
}

# ============================================================
# 3.2 Key shared network checks
# ============================================================
echo "=== Shared Network Checks ==="
check_shared_network "coolify-proxy" "Hermes Agent-qgtzrmi6771lt8l7x8rqx72f"
check_shared_network "zappro-litellm" "zappro-wav2vec2"
check_shared_network "coolify-proxy" "zappro-litellm"

# ============================================================
# 3.3 TCP connectivity from container to backend (AP-1 check)
# ============================================================
echo ""
echo "=== TCP Connectivity Checks ==="

check_tcp_from_container() {
    local container="$1"; local target="$2"; local port="$3"
    if timeout 5 bash -c "docker exec $container sh -c 'echo >/dev/tcp/$target/$port'" 2>/dev/null; then
        echo "✅ $container → $target:$port TCP OK"
        return 0
    else
        echo "❌ $container → $target:$port TCP FAILED"
        return 1
    fi
}

# Test LiteLLM → wav2vec2 (both containerized — should work)
check_tcp_from_container "zappro-litellm" "wav2vec2" "8201"

# Test LiteLLM → Ollama (host native — AP-1 anti-pattern, expected to fail)
check_tcp_from_container "zappro-litellm" "10.0.1.1" "11434" && \
    echo "⚠️  WARNING: Ollama at 10.0.1.1 reachable from container (should be containerized!)"

# ============================================================
# 3.4 HTTP connectivity from container to backend
# ============================================================
echo ""
echo "=== HTTP Connectivity Checks ==="

check_http_from_container() {
    local container="$1"; local url="$2"; local expected="${3:-200}"
    local code
    code=$(docker exec "$container" curl -sf -m 5 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$code" = "$expected" ]; then
        echo "✅ $container → $url HTTP $code"
        return 0
    else
        echo "❌ $container → $url HTTP $code (expected $expected)"
        return 1
    fi
}

check_http_from_container "zappro-litellm" "http://wav2vec2:8201/health" "200"
```

### Anti-Patterns Prevenidos

**AP-1: Host Process como Backend de Container** — Docker bridge não consegue TCP para portas de processos nativos do host. Verificar se Ollama (10.0.1.1:11434) é containerizado.

**AP-2: Testar Conectividade só do Host** — `curl localhost:8201` funciona do host mas não passa pela bridge Docker. Testar sempre de dentro do container.

### Acceptance Criteria

- [ ] Traefik ↔ Hermes Agent share at least one network
- [ ] LiteLLM ↔ wav2vec2 share at least one network
- [ ] `check_tcp_from_container` LiteLLM → wav2vec2:8201 returns OK
- [ ] LiteLLM → 10.0.1.1:11434 is flagged if reachable (AP-1 warning)

---

## PHASE 4: Routing Verification

### Procedure

```bash
# ============================================================
# 4.1 Traefik local health (from host)
# ============================================================
echo "=== Routing Verification ==="

HTTP_CODE=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "http://localhost:80/ping" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Traefik health (localhost:80/ping): HTTP $HTTP_CODE"
else
    echo "❌ Traefik health (localhost:80/ping): HTTP $HTTP_CODE"
fi

# ============================================================
# 4.2 DNS resolution
# ============================================================
FQDN="Hermes Agent-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
if nslookup "$FQDN" >/dev/null 2>&1; then
    echo "✅ DNS resolves: $FQDN"
else
    echo "❌ DNS failed: $FQDN"
fi

# ============================================================
# 4.3 Backend health via Cloudflare Tunnel (AP-4 check)
# ============================================================
HTTP_CODE=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://bot.zappro.site/" 2>/dev/null || echo "000")
case "$HTTP_CODE" in
    200|401) echo "✅ Hermes Agent via bot.zappro.site: HTTP $HTTP_CODE (routing OK)" ;;
    *)       echo "❌ Hermes Agent via bot.zappro.site: HTTP $HTTP_CODE (routing FAIL)" ;;
esac

# ============================================================
# 4.4 Health endpoint returns 200 (not 502/504)
# ============================================================
HTTP_CODE=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://bot.zappro.site/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ /health endpoint: HTTP $HTTP_CODE"
else
    echo "❌ /health endpoint: HTTP $HTTP_CODE (expected 200)"
fi

# ============================================================
# 4.5 App responds, not 502 (Traefik → backend route works)
# ============================================================
HTTP_CODE=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://bot.zappro.site/" 2>/dev/null || echo "000")
case "$HTTP_CODE" in
    200|401) echo "✅ App responds via Traefik: HTTP $HTTP_CODE (not 502)" ;;
    502|504) echo "❌ Traefik → backend routing broken: HTTP $HTTP_CODE" ;;
    *)       echo "⚠️  Unexpected response: HTTP $HTTP_CODE" ;;
esac
```

### Anti-Pattern Prevenido

**AP-4: DNS/Tunnel UP = Service UP** — Cloudflare Tunnel pode estar UP mas o backend não estar a correr. Sempre verificar `/health` e a resposta real do app.

### Acceptance Criteria

- [ ] `curl localhost:80/ping` returns HTTP 200
- [ ] DNS resolves for Hermes Agent FQDN
- [ ] `curl https://bot.zappro.site/` returns 200 or 401 (not 502/504)
- [ ] `curl https://bot.zappro.site/health` returns HTTP 200

---

## PHASE 5: Smoke Test

### Procedure

```bash
# ============================================================
# 5.1 Run pipeline smoke test
# ============================================================
echo "=== Running Smoke Test ==="
echo "Script: tasks/smoke-tests/pipeline-Hermes Agent-voice.sh"
echo ""

# Required env vars
: "${LITELLM_KEY:?LITELLM_KEY required}"
: "${MINIMAX_API_KEY:?MINIMAX_API_KEY required}"

# Run smoke test (capture exit code)
bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh
SMOKE_EXIT=$?

# ============================================================
# 5.2 Interpret results
# ============================================================
if [ $SMOKE_EXIT -eq 0 ]; then
    echo ""
    echo "✅ SMOKE TEST PASSED — deploy is healthy"
else
    echo ""
    echo "❌ SMOKE TEST FAILED (exit $SMOKE_EXIT) — see output above"
fi

echo ""
echo "SMOKE_EXIT=$SMOKE_EXIT"
```

### Expected Output

```
========================================
Hermes Agent Voice Pipeline Smoke Test
Data: 08/04/2026
========================================

[TEST] === 1. Infrastructure Health ===
[PASS] Hermes Agent container running
[PASS] Traefik proxy healthy
[PASS] Hermes Agent FQDN DNS resolves
[PASS] Hermes Agent via bot.zappro.site (HTTP 200)
[PASS] Traefik ↔ Hermes Agent share network: qgtzrmi6771lt8l7x8rqx72f
[PASS] Hermes Agent /healthz inside container

... (all sections)

========================================
SUMMARY
========================================
Total:   20
[PASS] Passed: 20
[FAIL] Failed: 0

✅ All tests passed!
```

### Anti-Pattern Prevenido

**Smoke test não executado** — deploy anunciado como "pronto" sem validar que o pipeline funciona end-to-end.

### Acceptance Criteria

- [ ] Smoke test exit code = 0
- [ ] All infrastructure checks pass (phase 1-4)
- [ ] STT (wav2vec2) responding
- [ ] TTS (Kokoro) synthesizing
- [ ] LLM (Tom Cat) responding
- [ ] No critical failures in output

---

## PHASE 6: Rollback Trigger

### Trigger Conditions

Executar rollback **automaticamente** se:

| Condition | Severity | Action |
|-----------|----------|--------|
| Smoke test exit code != 0 | CRITICAL | Rollback immediately |
| Container in restart loop | HIGH | Rollback if persistent |
| All routing returns 502 | HIGH | Rollback immediately |
| ZFS snapshot created but phase 5 failed | HIGH | Rollback immediately |

### Rollback Procedure

```bash
# ============================================================
# 6.1 Identify snapshot to rollback to
# ============================================================
echo "=== Rollback Decision ==="
echo "Finding most recent pre-deploy snapshot..."

# List snapshots from today for current user
SNAPSHOT=$(zfs list -t snapshot -S creation -r tank 2>/dev/null | \
    grep "pre-$(date +%Y%m%d)" | grep "$(whoami)-deploy" | \
    head -1 | awk '{print $1}')

if [ -z "$SNAPSHOT" ]; then
    echo "ERROR: No pre-deploy snapshot found for today"
    echo "Manual intervention required"
    exit 2
fi

echo "Rollback target: $SNAPSHOT"

# ============================================================
# 6.2 Identify what failed
# ============================================================
echo ""
echo "What failed (from smoke test output above):"
echo "  - Check Phase 5 output for [FAIL] markers"
echo "  - Record the FAILED=N count"
echo ""

# ============================================================
# 6.3 Stop services to prevent conflicts
# ============================================================
echo "Stopping affected services..."
# Find and stop containers that might be in bad state
for container in Hermes Agent-qgtzrmi6771lt8l7x8rqx72f zappro-litellm zappro-wav2vec2; do
    docker stop "$container" 2>/dev/null && echo "  Stopped: $container" || echo "  Not running: $container"
done

# ============================================================
# 6.4 Execute rollback
# ============================================================
echo ""
echo "⚠️  EXECUTING ZFS ROLLBACK"
echo "⚠️  This destroys all changes since snapshot: $SNAPSHOT"
echo ""

read -p "Confirm rollback? (type 'yes': " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 1
fi

sudo zfs rollback -r "$SNAPSHOT"
ROLLBACK_EXIT=$?

# ============================================================
# 6.5 Post-rollback verification
# ============================================================
if [ $ROLLBACK_EXIT -eq 0 ]; then
    echo ""
    echo "✅ Rollback successful"
    echo ""
    echo "Restarting services..."
    # Restart containers (docker-compose or individual)
    docker ps

    echo ""
    echo "NEXT STEPS:"
    echo "  1. Verify containers are back to previous state"
    echo "  2. Re-run deploy-validator to confirm health"
    echo "  3. Investigate root cause of smoke test failure"
    echo "  4. After fix: create new snapshot, re-run deploy"
else
    echo ""
    echo "❌ ROLLBACK FAILED — manual intervention required"
    echo "  Exit code: $ROLLBACK_EXIT"
    echo "  Try: sudo zfs rollback -r $SNAPSHOT"
fi
```

### Rollback Report Template

```markdown
## Rollback Report

**Data:** YYYY-MM-DD HH:MM
**Trigger:** Smoke test failed (exit N)
**Snapshot:** tank@pre-YYYYMMDD-HHMMSS-username-deploy

### What Failed
- [List failed checks from smoke test output]

### What Was Rolled Back
- [ZFS snapshot that was rolled back]
- [Datasets affected]

### Next Steps
- [ ] Investigate root cause
- [ ] Fix issue
- [ ] Create new snapshot
- [ ] Re-run deploy-validator
- [ ] Re-deploy
```

### Acceptance Criteria

- [ ] Snapshot identified before rollback
- [ ] Failure point documented
- [ ] Rollback executed with `-r` flag (recursive)
- [ ] Rollback exit code = 0
- [ ] Services restarted
- [ ] Rollback report generated

---

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | All phases passed — deploy is healthy | Proceed |
| 1 | Smoke test failed — rollback triggered | Execute rollback procedure |
| 2 | Snapshot creation failed | Abort deploy, investigate |
| 3 | Container health check failed | Abort deploy, investigate |
| 4 | Network connectivity failed | Abort deploy, investigate |
| 5 | Routing verification failed | Abort deploy, investigate |
| 99 | Prerequisites not met | Set up environment |

---

## Integration: Gitea Actions

```yaml
# .gitea/workflows/deploy-validate.yml

name: Deploy Validator

on:
  workflow_dispatch:
    inputs:
      deploy_target:
        description: 'Deploy target (e.g., Hermes Agent, litellm)'
        required: true
        type: choice
        options:
          - Hermes Agent
          - litellm
          - wav2vec2
          - full-pipeline

jobs:
  validate:
    runs-on: linux
    container: alpine:latest
    steps:
      - name: Install dependencies
        run: |
          apk add --no-cache docker zfs curl python3 coreutils grep

      - name: PHASE 1 — ZFS Snapshot
        run: |
          SNAPSHOT="tank@pre-$(date +%Y%m%d-%H%M%S)-gitea-deploy"
          sudo zfs snapshot -r "$SNAPSHOT"
          echo "SNAPSHOT=$SNAPSHOT" >> $GITHUB_ENV

      - name: PHASE 2 — Container Health
        run: |
          for container in Hermes Agent-qgtzrmi6771lt8l7x8rqx72f zappro-litellm zappro-wav2vec2; do
            STATUS=$(docker ps --filter "name=$container" --format "{{.Status}}")
            if ! echo "$STATUS" | grep -q "^Up"; then
              echo "❌ Container not running: $container"
              exit 3
            fi
          done
          echo "✅ All containers healthy"

      - name: PHASE 3 — Network Connectivity
        run: |
          # Check shared networks using verify-network.sh
          if [ -f docs/OPERATIONS/SKILLS/verify-network.sh ]; then
            bash docs/OPERATIONS/SKILLS/verify-network.sh || exit 4
          fi

      - name: PHASE 4 — Routing Verification
        run: |
          code=$(curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://bot.zappro.site/health")
          [ "$code" = "200" ] || { echo "❌ Routing failed: HTTP $code"; exit 5; }
          echo "✅ Routing verified"

      - name: PHASE 5 — Smoke Test
        env:
          LITELLM_KEY: ${{ secrets.LITELLM_KEY }}
          MINIMAX_API_KEY: ${{ secrets.MINIMAX_API_KEY }}
        run: |
          bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh
          SMOKE_EXIT=$?
          if [ $SMOKE_EXIT -ne 0 ]; then
            echo "❌ Smoke test failed — triggering rollback"
            # Gitea Actions handles rollback via next job
            exit $SMOKE_EXIT
          fi
          echo "✅ Smoke test passed"

      - name: PHASE 6 — Success
        if: success()
        run: |
          echo "✅ Deploy validated successfully"
          # Cleanup old snapshots (keep last 5)
          sudo zfs list -t snapshot -r tank -S creation | \
            grep "pre-" | tail -n +6 | awk '{print $1}' | \
            while read snap; do sudo zfs destroy "$snap" 2>/dev/null; done

      rollback:
        needs: validate
        if: failure() && needs.validate.result == 'failure'
        runs-on: linux
        steps:
          - name: Rollback ZFS
        run: |
            SNAPSHOT="${{ env.SNAPSHOT }}"
            echo "Rolling back to: $SNAPSHOT"
            docker stop Hermes Agent-qgtzrmi6771lt8l7x8rqx72f \
              zappro-litellm zappro-wav2vec2 2>/dev/null || true
            sudo zfs rollback -r "$SNAPSHOT"
```

---

## Integration: Cron / Scheduled Validation

```bash
# ~/.claude/scheduled_tasks.json entry
# Run deploy validator every 30 minutes as health check
{
  "cron": "*/30 * * * *",
  "prompt": "Run deploy-validator skill and alert on any FAIL. If smoke test fails, automatically rollback to most recent pre-deploy snapshot.",
  "durable": true
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `tasks/smoke-tests/pipeline-Hermes Agent-voice.sh` | Smoke test script |
| `docs/INCIDENTS/INCIDENT-2026-04-08-voice-pipeline-stable.md` | Incident root causes and anti-patterns |
| `docs/OPERATIONS/SKILLS/verify-network.sh` | Network connectivity verification |
| `docs/OPERATIONS/SKILLS/zfs-snapshot-and-rollback.md` | ZFS snapshot/rollback skill |
| `docs/OPERATIONS/SKILLS/traefik-health-check.md` | Traefik diagnostic |
| `docs/OPERATIONS/SKILLS/liteLLM-health-check.md` | LiteLLM diagnostic |
| `docs/OPERATIONS/SKILLS/wav2vec2-health-check.md` | wav2vec2 STT diagnostic |

---

## Anti-Patterns Summary

| ID | Anti-Pattern | Detection in This Skill |
|----|--------------|------------------------|
| AP-1 | Host process as Docker backend | Phase 3: `check_tcp_from_container` flags 10.0.1.1:11434 |
| AP-2 | Test from host only | Phase 3: HTTP checks run inside containers |
| AP-3 | Health check without route check | Phase 2: `docker exec curl` internal endpoint |
| AP-4 | DNS/Tunnel UP = Service UP | Phase 4: `/health` and app response checks |

---

## Quick Reference

```bash
# ONE-LINER: Full validation (all phases)
# Requires: LITELLM_KEY, MINIMAX_API_KEY (source .env first)
cd /srv/monorepo && source .env

sudo zfs snapshot -r "tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)-deploy" \
&& bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh \
&& echo "✅ Deploy validated"

# QUICK ROLLBACK (if smoke test fails)
SNAPSHOT=$(zfs list -t snapshot -S creation -r tank 2>/dev/null | grep "pre-$(date +%Y%m%d)" | head -1 | awk '{print $1}') \
&& docker stop Hermes Agent-qgtzrmi6771lt8l7x8rqx72f zappro-litellm zappro-wav2vec2 2>/dev/null \
&& sudo zfs rollback -r "$SNAPSHOT" \
&& docker ps
```
