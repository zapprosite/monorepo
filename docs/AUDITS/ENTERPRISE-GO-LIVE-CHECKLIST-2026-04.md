# ENTERPRISE-GO-LIVE-CHECKLIST-2026-04
## Nexus Full-Stack Automation — Pre-Flight Checks

**Data:** 2026-04-27
**Status:** DRAFT → PENDING REVIEW
**Owner:** Platform Engineering

---

## 1. Cloudflared Tunnel

| Check | Result | Notes |
|-------|--------|-------|
| Serviço ativo | ✅ PASS | `cloudflared.service` — active (running) |
| hermes.zappro.site | ⚠️ 404 | Access não configurado — endpoint existe mas não responde (404 cloudflare) |
| llm.zappro.site | ✅ PASS | LiteLLM :4000 OK — `{"error...auth_error"}` esperado (sem key) |
| api.zappro.site | ✅ PASS | LiteLLM legado :4000 — redirect p/ Cloudflare Access (esperado) |
| qdrant.zappro.site | ⚠️ 302 | Access não configurado — redirect p/ Cloudflare Access login |

**Ação Pendente:** Configurar Access policy para `hermes.zappro.site` e `qdrant.zappro.site` (mesmo processo que api.zappro.site).

---

## 2. Workspace Drift

| Check | Result |
|-------|--------|
| `package.json` workspaces | `['apps/*', 'packages/*']` |
| `pnpm-workspace.yaml` canônico | `packages: ['apps/*', 'packages/*', 'mcps/*']` |

**Veredicto:** DRIFT detected — `mcps/*` está em `pnpm-workspace.yaml` mas NÃO em `package.json` workspaces.
Isto éBY DESIGN? ou missing?

- Se `mcps/*` é intencional → adicionar a `package.json` workspaces
- Se não é usado → remover de `pnpm-workspace.yaml`

**Ação:** `pnpm-workspace.yaml` é o canônico (monorepo tooling). Manter como está E adicionar `mcps/*` ao `package.json` workspaces para evitar drift do pnpm.

---

## 3. Lockfile Policy

| Lockfile | Status | Veredicto |
|----------|--------|-----------|
| `bun.lock` na root | ✅ presente | Bun toolchain confirmado |
| `apps/ai-gateway/pnpm-lock.yaml` | ⚠️ existe | Justificado? Não encontrado |

**Ação:** apps/ai-gateway/pnpm-lock.yaml NÃO deveria existir num repo Bun-rooted. Remover em PR separado OU justificar como exception documentada.

**Recomendação:** Manter só `bun.lock` na root. Remover `apps/ai-gateway/pnpm-lock.yaml` — se ai-gateway precisar de pnpm, converter o app para Bun.

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
| hermes.zappro.site Access | P0 | ⚠️ PENDING — sem Access policy |
| qdrant.zappro.site Access | P0 | ⚠️ PENDING — sem Access policy |
| Workspace drift (mcps/*) | P1 | ⚠️ PENDING — decisão needed |
| apps/ai-gateway pnpm-lock | P1 | ⚠️ PENDING — remover ou justificar |
| queue-manager.py commit | P1 | ✅ CONFIRMED — `028c111` on Gitea |
| docs/AUDITS/GO-LIVE-CHECKLIST | P2 | ✅ DONE (este ficheiro) |

---

## Veredicto Final

```
╔═══════════════════════════════════════════════════╗
║           ENTERPRISE READINESS CLOSER             ║
╠═══════════════════════════════════════════════════╣
║  cloudflared:        ✅ PASS (restarted + active)   ║
║  llm.zappro.site:   ✅ PASS (LiteLLM :4000)        ║
║  api.zappro.site:   ✅ PASS (LiteLLM legacy)       ║
║  hermes.zappro:     ⚠️  P0 — Access not configured║
║  qdrant.zappro:     ⚠️  P0 — Access not configured ║
║  Workspace drift:   ⚠️  P1 — mcps/*不一致           ║
║  Lockfile:           ⚠️  P1 — pnpm-lock.yaml orphan║
║  queue-manager.py:   ✅ CONFIRMED Gitea 028c111     ║
╠═══════════════════════════════════════════════════╣
║  BLOCKERS: 2 (P0) — Access policy p/ hermes + qdrant║
║  PENDING: 2 (P1) — workspace drift + lockfile        ║
╚═══════════════════════════════════════════════════╝
```

**Primeiro projeto full-stack recomendado:** `SPEC-092` (Trieve RAG) — já em `gitea/feature/spec-092-trieve-rag`. Não bloqueia enterprise readiness. Pode proceder em paralelo às correções P0.

**Próximo passo imediato:** Configurar Access policy para hermes e qdrant (mesma config que api.zappro.site usa em `/etc/cloudflared/config.yml`).
