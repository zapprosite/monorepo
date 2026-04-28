# Plan: OpenClaw OAuth Persistent Profiles

**Research Date:** 2026-04-08
**Status:** RESEARCH COMPLETE — PLANNING PHASE
**Spec:** SPEC-007-openclaw-oauth-profiles.md

---

## Research Findings Summary

1. **Browser:** Chromium no container `browser-*` (coollabsio/openclaw-browser)
2. **Chrome profile:** `/config/.config/chromium/Default/` em volume Docker
3. **Problema:** Coolify sobrescreve volumes em redeploy
4. **Solução recomendada:** Playwright `storageState` JSON (não Chrome profile dir)

---

## Architecture Proposta

```
/srv/data/openclaw-auth/
├── gemini/
│   └── storage-state.json    → Gemini OAuth cookies + localStorage
└── perplexity/
    └── storage-state.json    → Perplexity OAuth cookies + localStorage
```

**Fluxo:**
1. Automation script (Playwright/Node) conecta via CDP ao browser
2. Cria contexto, faz login OAuth, salva `storageState`
3. OpenClaw usa `storageState` para  já autenticado
4. Volumes montados do host → persistem entre restarts

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 1: Infrastructure                    │
│  1. Criar dirs /srv/data/openclaw-auth/{gemini,perplexity} │
│  2. Verificar PUID 1000:1000 no host                      │
│  3. Configurar bind mounts no Coolify (não volume managed)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 2: OAuth Automation                  │
│  4. Criar script oauth-login.js (CDP + storageState)       │
│  5. Integrar com Infisical (credenciais GEMINI/PERPLEXITY) │
│  6. Testar login Gemini via automation                     │
│  7. Testar login Perplexity via automation                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 3: OpenClaw Integration              │
│  8. Configurar OpenClaw para usar storageState por contexto │
│  9. Criar dois "bots": CEO-MIX-Gemini + CEO-MIX-Perplexity │
│  10. Integrar com perplexity-agent (CEO MIX leads agent)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 4: Validation                        │
│  11. Smoke test: login persiste após restart               │
│  12. E2E: OpenClaw browse web.zappro.site logado         │
│  13. Health check: sessões OAuth ativas                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Tasks

### Phase 1: Infrastructure
- [ ] **T1.1** Criar `/srv/data/openclaw-auth/{gemini,perplexity}` com perm 777
- [ ] **T1.2** Verificar se `id will` retorna 1000:1000
- [ ] **T1.3** Documentar bind mount pattern no SPEC-007

### Phase 2: OAuth Automation
- [ ] **T2.1** Criar `oauth-auto-login.js` — conecta CDP, cria contexto, login, salva storageState
- [ ] **T2.2** Buscar credenciais GEMINI_EMAIL/TOKEN e PERPLEXITY_EMAIL/TOKEN do Infisical
- [ ] **T2.3** Testar automation Gemini — verificar storage-state.json criado
- [ ] **T2.4** Testar automation Perplexity — verificar storage-state.json criado

### Phase 3: OpenClaw Integration
- [ ] **T3.1** Configurar OpenClaw com `BROWSER_STORAGE_STATE` ou similar
- [ ] **T3.2** Criar dois perfis/contextos no OpenClaw (gemini + perplexity)
- [ ] **T3.3** Testar que OpenClaw consegue usar storageState para autenticar

### Phase 4: Validation
- [ ] **T4.1** Restartar browser container, verificar que sessões persistem
- [ ] **T4.2** E2E: OpenClaw browse web.zappro.site com conta Gemini
- [ ] **T4.3** E2E: OpenClaw browse web.zappro.site com conta Perplexity
- [ ] **T4.4** Criar smoke test em `tests/openclaw-oauth-smoke.sh`

---

## Checkpoints

| Checkpoint | Criteria |
|------------|----------|
| CP-1 (após T1.3) |Dirs criados, PUID verificado, bind mounts documentados |
| CP-2 (após T2.4) | Ambos storage-state.json existem com cookies válidos |
| CP-3 (após T3.3) | OpenClaw consegue browse logado sem pedir re-auth |
| CP-4 (após T4.4) | Smoke test passa, documentação atualizada |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Coolify sobrescreve volumes | High | High | Bind mounts (host paths), não Docker volumes |
| OAuth token expira | Medium | Medium | Re-auth script, refresh token handling |
| Chrome profile locked | Low | High | Garantir único writer por perfil |
| PUID mismatch | Low | Medium | Verificar `id will` antes de começar |

---

## Next Action

Executar **T1.1 + T1.2** (criar dirs e verificar PUID) antes de prosseguir.
