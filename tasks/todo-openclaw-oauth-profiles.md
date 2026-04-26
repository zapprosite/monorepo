# TODO: OpenClaw OAuth Persistent Profiles

**Created:** 2026-04-08
**Plan:** tasks/plan-openclaw-oauth-profiles.md

## Phase 1: Infrastructure
- [ ] T1.1: Criar dirs `/srv/data/openclaw-auth/{gemini,perplexity}` (PUID 1000:1000 ✅ játem)
- [ ] T1.2: Verificar PUID ✅ (1000:1000 confirmado)
- [ ] T1.3: Atualizar SPEC-007 com bind mount pattern do openclaw

## Phase 2: OAuth Automation
- [ ] T2.1: Criar `oauth-auto-login.js` — CDP + storageState
- [ ] T2.2: Integrar Infisical (GEMINI_EMAIL/PERPLEXITY_EMAIL)
- [ ] T2.3: Testar Gemini login → storage-state.json
- [ ] T2.4: Testar Perplexity login → storage-state.json

## Phase 3: OpenClaw Integration
- [ ] T3.1: Configurar OpenClaw para usar storageState
- [ ] T3.2: Criar dois perfis/contextos (gemini + perplexity)
- [ ] T3.3: Validar que OpenClaw usa sessão sem re-auth

## Phase 4: Validation
- [ ] T4.1: Restart browser, verificar sessões persistem
- [ ] T4.2: E2E Gemini — browse logado
- [ ] T4.3: E2E Perplexity — browse logado
- [ ] T4.4: Criar smoke test `tests/openclaw-oauth-smoke.sh`
