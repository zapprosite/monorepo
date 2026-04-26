# Todo: OpenClaw Persona + Audio Stack

## Status: IN PROGRESS — 2026-04-08

---

## Tasks

### Task 1: SPEC-OpenClaw-Persona Audio Stack
**Status:** pending
**SPEC:** `docs/specflow/SPEC-009-openclaw-persona-audio-stack.md`
**Description:** Documentar arquitetura completa (STT → LLM → TTS) com proibicos
**Verification:** Ficheiro criado com diagrama e checklist

---

### Task 2: Atualizar openclaw.json com Persona
**Status:** pending
**File:** `/data/.openclaw/openclaw.json`
**Description:** Adicionar identity (name, theme) e config de audio PT-BR
**Verification:** smoke test 15/15 pass

---

### Task 3: Criar openclaw-audio-governance.md rule
**Status:** pending
**File:** `.claude/rules/openclaw-audio-governance.md`
**Description:** REGRA para LLM nao propor mudanca de audio stack
**Verification:** Ficheiro criado e referenciado

---

### Task 4: Atualizar GUARDRAILS.md
**Status:** pending
**File:** `docs/GOVERNANCE/GUARDRAILS.md`
**Description:** Tabela de audio pipeline protegido
**Verification:** Secao Voice/Audio Pipeline presente

---

### Task 5: Verificar TTS Bridge bloqueio
**Status:** pending
**Description:** Testar que vozes nao-PT-BR retornam 400
**Verification:** `af_sarah` → 400, `pm_santa` → 200

---

### Task 6: Prune audio files nao-PT-BR
**Status:** pending
**Description:** Limpar /tmp de audio files de teste
**Verification:** `find /tmp -name "*.wav" -o -name "*.mp3"` vazio ou só PT-BR

---

## Dependencies

- Task 3 (rule) depende de Task 1 (SPEC)
- Task 4 (GUARDRAILS) depende de Task 1 (SPEC)
- Task 2 (openclaw.json) depende de Task 1 (SPEC)

---

## Progress

- [x] Plan created: `tasks/PLAN-openclaw-persona-audio-stack.md`
- [x] Task 1: SPEC-009 created
- [x] Task 2: openclaw.json updated with identity + TTS Bridge baseUrl
- [x] Task 3: Rule created `.claude/rules/openclaw-audio-governance.md`
- [x] Task 4: GUARDRAILS.md updated (Voice/Audio Pipeline section)
- [x] Task 5: TTS Bridge verification — af_sarah→400, pm_santa→200 ✅
- [x] Task 6: Non-PT-BR audio files pruned from /tmp

---

**Last updated:** 2026-04-08
**Owner:** will + Claude Code