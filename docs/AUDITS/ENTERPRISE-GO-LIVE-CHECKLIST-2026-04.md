# ENTERPRISE-GO-LIVE-CHECKLIST-2026-04
## Nexus Full-Stack Automation — Pre-Flight Checks

**Data:** 2026-04-27
**Status:** ✅ CLOSED — All P0/P1 blockers resolved
**Owner:** Platform Engineering
**Closed by:** Nexus SRE + Claude Opus 4.7

---

## 1. Cloudflared Tunnel

| Check | Result | Notes |
|-------|--------|-------|
| Serviço ativo | ✅ PASS | `cloudflared.service` — active (running) |
| hermes.zappro.site | ✅ PASS | Cloudflare Access — `302 → Access login` |
| llm.zappro.site | ✅ PASS | ai-gateway `:4002` — `401 auth error` |
| api.zappro.site | ✅ PASS | LiteLLM legacy `:4000` — `302 Access redirect` |
| qdrant.zappro.site | ✅ PASS | **DNS REMOVIDO** — `404 Not Found` |

**Ação concluída:**
- Hermes Access app + policy aplicadas via Terraform
- Qdrant DNS record destruído via Terraform — rota pública eliminada
- llm drift corrigido — agora aponta para `:4002` (ai-gateway)

---

## 2. Workspace Drift

| Check | Result |
|-------|--------|
| `package.json` workspaces | `['apps/*', 'packages/*', 'mcps/*']` ✅ |
| `pnpm-workspace.yaml` canônico | `packages: ['apps/*', 'packages/*', 'mcps/*']` ✅ |

**Veredicto:** ✅ RESOLVED — `mcps/*` adicionado ao `package.json` workspaces. Sem drift.

---

## 3. Lockfile Policy

| Lockfile | Status | Veredicto |
|----------|--------|-----------|
| `bun.lock` na root | ✅ presente | Bun toolchain confirmado |
| `apps/ai-gateway/pnpm-lock.yaml` | ✅ REMOVIDO | Lockfile orphan eliminado |

**Ação:** `apps/ai-gateway/pnpm-lock.yaml` removido do repositório. Monorepo usa `bun.lock` como lockfile canônico.

---

## 4. Vibe-Kit Source of Truth

| Item | Status |
|------|--------|
| `queue-manager.py` commit | `028c111` — `fix(vibe-kit): serialize queue ops with fcntl.flock + 20 workers` |
| Remote primário | **Gitea** (`ssh://git@127.0.0.1:2222/will-zappro/monorepo.git`) |
| GitHub remoto | existe mas não é primário (`origin`) |
| Runner ativo usa queue-manager.py | ✅ confirmado — lock file + queue.json em uso |

**Veredicto:** Gitea é source of truth. GitHub é mirror read-only.

---

## 5. GO-LIVE Checklist Summary

| Task | Priority | Status |
|------|----------|--------|
| cloudflared restart | P0 | ✅ DONE |
| hermes.zappro.site Access | P0 | ✅ DONE — Terraform apply |
| qdrant.zappro.site public route | P0 | ✅ DONE — DNS destroyed |
| Workspace drift (mcps/*) | P1 | ✅ DONE — package.json updated |
| apps/ai-gateway pnpm-lock | P1 | ✅ DONE — removed |
| queue-manager.py commit | P1 | ✅ CONFIRMED — `028c111` on Gitea |
| docs/AUDITS/GO-LIVE-CHECKLIST | P2 | ✅ DONE (este ficheiro) |

---

## Infra Local — Config Files

| File | Status | Action |
|------|--------|--------|
| `/etc/cloudflared/config.yml` | ✅ SYNC | llm→:4002, qdrant→:404 |
| `/etc/systemd/system/cloudflared.service` | ✅ FIXED | `--config` before `tunnel run` |
| Terraform state | ✅ APPLIED | Hermes Access + Qdrant removal |

---

## Veredicto Final

```
╔═══════════════════════════════════════════════════╗
║           ENTERPRISE READINESS CLOSER             ║
╠═══════════════════════════════════════════════════╣
║  cloudflared:        ✅ PASS (active)              ║
║  llm.zappro.site:   ✅ PASS (:4002 ai-gateway)   ║
║  api.zappro.site:   ✅ PASS (:4000 LiteLLM)      ║
║  hermes.zappro:     ✅ PASS (Access applied)     ║
║  qdrant.zappro:     ✅ PASS (DNS destroyed)      ║
║  Workspace drift:   ✅ PASS (mcps/* synced)       ║
║  Lockfile:          ✅ PASS (orphan removed)     ║
║  queue-manager.py:  ✅ CONFIRMED Gitea 028c111   ║
╠═══════════════════════════════════════════════════╣
║  ALL P0/P1 BLOCKERS: ✅ RESOLVED                 ║
║  SPEC-001 HVAC RAG: 🔓 UNBLOCKED                ║
╚═══════════════════════════════════════════════════╝
```

**Estado:** Todos os blockers resolvidos. Enterprise readiness fechado.

**Próximo passo:** SPEC-001 HVAC RAG pode prosseguir. Qdrant foi removido da borda pública — SPEC-001 não deve depender de qdrant.zappro.site público.
