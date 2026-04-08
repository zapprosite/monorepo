# Tasks — Use Case ROI Maximization

**Source:** plan.md (2026-04-07)  
**Status:** PENDING — awaiting human review

---

## Slice 1: Corrigir Cron Jobs com Agents Errados

**SPEC Reference:** SPEC-001:AC-1 (cron jobs)

- [ ] **[SC-1.1]** Listar todos cron jobs com agent references errados
- [ ] **[SC-1.2]** Substituir `modo-dormir-daily` → `/rs` (repo-scan)
- [ ] **[SC-1.3]** Substituir `code-review-daily` → `/review`
- [ ] **[SC-1.4]** Substituir `secrets-audit-daily` → `/sec`
- [ ] **[SC-1.5]** Substituir `test-coverage-daily` → smarter fallback

**Verification:** `grep -rE "agent-|subagent" .claude/scheduled_tasks.json` retorna vazio

---

## Slice 2: Ativar Pre-commit Hook

**SPEC Reference:** SPEC-001:AC-3 (security)

- [ ] **[SC-2.1]** Copiar `.claude/hooks/pre-commit` → `.git/hooks/pre-commit`
- [ ] **[SC-2.2]** Configurar `git config core.hooksPath .git/hooks`
- [ ] **[SC-2.3]** Testar com staged file contendo "ghp_"

**Verification:** `git commit` com secret no file → rejected

---

## Slice 3: Completar ADR Records

**SPEC Reference:** SPEC-001:AC-4 (documentation)

- [ ] **[SC-3.1]** Listar todos ADRs com "pending" ou "TODO"
- [ ] **[SC-3.2]** Preencher ADRs pendentes com context + justification
- [ ] **[SC-3.3]** Criar novo ADR para Infisical integration decision

**Verification:** `grep -r "pending\|TODO" docs/adr/*.md` retorna vazio

---

## Slice 4: Voice Pipeline Test Suite

**SPEC Reference:** SPEC-001:AC-5 (voice pipeline)

- [ ] **[SC-4.1]** Criar `tasks/smoke-tests/pipeline-voice.yaml`
- [ ] **[SC-4.2]** Implementar test: Whisper API health check
- [ ] **[SC-4.3]** Implementar test: Kokoro TTS health check
- [ ] **[SC-4.4]** Implementar test: Telegram bot token validation
- [ ] **[SC-4.5]** Executar suite e documentar resultados

**Verification:** `bash tasks/smoke-tests/run-smoke-tests.sh voice` → 80%+ pass

---

## Slice 5: Infisical → Coolify Secret Migration

**SPEC Reference:** SPEC-001:AC-6 (secrets management)

- [ ] **[SC-5.1]** Mapear todos os .env files em `/srv/data/coolify/services/`
- [ ] **[SC-5.2]** Identificar quais secrets já estão no vault
- [ ] **[SC-5.3]** Criar script de migration para cada service
- [ ] **[SC-5.4]** Migrar OpenClaw secrets primeiro (prioridade)
- [ ] **[SC-5.5]** Migrar LiteLLM secrets
- [ ] **[SC-5.6]** Remover .env files plain text após migration

**Verification:** Nenhum .env em `/srv/data/coolify/services/*/.env` com API keys

---

## Stats

| Slice | Tasks | Priority |
|-------|-------|----------|
| SC-1 | 5 | CRITICAL |
| SC-2 | 3 | CRITICAL |
| SC-3 | 3 | HIGH |
| SC-4 | 5 | HIGH |
| SC-5 | 6 | MEDIUM |
| **Total** | **22** | |

---

## Pipeline

```
plan.md → todo.md → IMPLEMENT → REVIEW → SHIP
```
