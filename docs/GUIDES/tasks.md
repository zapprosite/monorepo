---
name: Tasks
description: Master task list extracted from SPECs
type: task-tracking
---

# Tasks — Generated from SPECs

**Last Updated:** 2026-04-10
**Source:** `docs/SPECS/SPEC-*.md`
**Generator:** `/pg` (pipeline-gen skill)

---

## Como Usar

- Este ficheiro é **gerado automaticamente** pelo `/pg`
- **NÃO editar manualmente** — edits serão sobrescritos
- Para adicionar tasks → criar/editar SPEC-*.md e rodar `/pg`

---

## Task Format

```markdown
- [ ] **[SPEC-016:AC-3]** Description — Acceptance criterion from SPEC
```

---

## Backlog

### Alta Prioridade

- [ ] **[SPEC-016:AC-1]** Configurar cron `*/5 * * * *` para voice-pipeline-loop.sh — verificar com `crontab -l | grep voice-pipeline`
- [ ] **[SPEC-016:AC-3]** Implementar auto-heal: TTS Bridge DOWN → `docker start zappro-tts-bridge`
- [ ] **[SPEC-021:T01]** Criar gitea-mcp.py — MCP server wrapper para Gitea API
- [ ] **[SPEC-021:T04]** ZFS snapshot antes de changes no cursor-loop
- [ ] **[SPEC-020:AC-1]** Criar openwebui_bridge_agent.py em docs/OPERATIONS/SKILLS/
- [ ] **[SPEC-020:AC-2]** Atualizar openwebui_mcp.py com tool `Hermes Agent_bridge_chat`
- [ ] **[SPEC-020:AC-3]** Atualizar Hermes Agent_mcp_wrapper.py com tool `chat_with_agent`

### Média Prioridade

- [ ] **[SPEC-016:AC-2]** Validar smoke test 18/18 passa em steady state — run manual
- [ ] **[SPEC-016:AC-4]** Testar Telegram alert em falha persistente — simulate failure
- [ ] **[SPEC-016:AC-5]** Verificar logs em `/srv/monorepo/logs/voice-pipeline/` — `ls -la logs/voice-pipeline/`
- [ ] **[SPEC-016:AC-6]** Verificar que loop não interfere com serviços normais após 1h
- [ ] **[SPEC-021:T02]** Testar cursor-loop com Coolify MCP
- [ ] **[SPEC-021:T03]** E2E smoke test (SPEC-020 bridge stack)
- [ ] **[SPEC-018:AC-1]** Deploy wav2vec2-deepgram-proxy em :8203

### Baixa Prioridade

- [ ] **[SPEC-021:T01]** Documentar gitea-mcp.py no README do projeto
- [ ] **[SPEC-016:AC-6]** Documentar hasil health check gap no SPEC-016

---

## Em Progresso

- [ ] **[SPEC-021:AC-2]** gitea-mcp.py criado e testado — em progresso
- [ ] **[SPEC-021:AC-3]** Cursor-loop completo funciona end-to-end — em progresso

---

## Done

- [x] **[SPEC-021:AC-1]** Todas as 10 skills/commands validadas e reais
- [x] **[SPEC-021:AC-2]** Nenhum placeholder em `.claude/agents/`
- [x] **[SPEC-021:AC-3]** Nenhum placeholder em `.claude/skills/`
- [x] **[SPEC-021:AC-4]** Package manager corrigido para pnpm em todos os workflows
- [x] **[SPEC-021:AC-5]** SPEC-021 fundido (esta versão)

---

## Stats

| Métrica | Valor |
|---------|-------|
| Total tasks | 18 |
| Alta prioridade | 7 |
| Em progresso | 2 |
| Done | 5 |

---

## Pipeline

```
Discovery → SPEC → TASKS → IMPLEMENT → REVIEW → SHIP
    ↑___________/[ regenerate via /pg ]___________↑
```

## SPEC Reference

| SPEC | Título | Prioridade |
|------|--------|------------|
| SPEC-016 | Voice Pipeline Cursor-Loop (Auto-Healer) | critical |
| SPEC-020 | OpenWebUI ↔ Hermes Agent Bridge | high |
| SPEC-021 | Claude Code CLI: Cursor-Loop + Skills Architecture | critical |
| SPEC-018 | wav2vec2-deepgram-proxy | medium |
