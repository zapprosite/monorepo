# SPEC-056: Cursor-Loop Enterprise Polish 2026

**Date:** 2026-04-16
**Author:** Principal Engineer
**Status:** PROPOSED
**Type:** Engineering Excellence
**Branch:** feature/swift-kernel-1776284093

---

## Objective

Polimento enterprise-grade do `/cursor-loop` e `/computer-loop` após review de 14 agentes. Corrigir 3 issues críticos identificados e aplicar padrões enterprise 2026 ao pipeline de tasks.

---

## Background

Review de 14 agentes ao commit `4ae1cd47` identificou:

```
59 files changed, 480 insertions(+), 1136 deletions(-)
17+ bugs críticos corrigidos (BRE→ERE, JSON injection, secrets mask)
Core: FUNCIONAL ✅
Issues: 3 críticos + 2 sugestões
```

### Issues Críticos Identificados

| ID  | Severity      | File                        | Line | Issue                                                              |
| --- | ------------- | --------------------------- | ---- | ------------------------------------------------------------------ |
| C1  | 🔴 Critical   | `cursor-loop-refactor.sh`   | 208  | `xargs echo` sem quotes — filenames com espaços quebram commit msg |
| C2  | 🔴 Critical   | `cursor-loop-runner.sh`     | 252  | sed strip "file" incorrecto — `myfile.ts` → `my`                   |
| C3  | 🔴 Critical   | `pipeline-state.sh`         | 76   | `printf` sem quotes em valid_states — word splitting potential     |
| S1  | 🔵 Suggestion | `bootstrap-check.sh`        | 53   | Threshold 8 hardcoded em secrets mask — não configurável           |
| S2  | 🔵 Suggestion | `smoke-multimodal-stack.sh` | 93   | `qwen2.5vl:7b` hardcoded — seguir anti-hardcoded env pattern       |

---

## Tech Stack — Enterprise 2026

| Componente    | Padrão                                                    |
| ------------- | --------------------------------------------------------- |
| Pipeline      | `tasks/pipeline.json` (Turbo 2.x "tasks", não "pipeline") |
| Agents        | 14 agents parallel via `/pg`                              |
| Orchestration | `/computer-loop` (estado da arte)                         |
| State         | `pipeline-state.sh` com JSON null via `--argjson`         |
| Validation    | `bootstrap-check.sh` + smoke tests                        |
| Code Quality  | Biome 1.x + `biome.json` quoteStyle:single                |

---

## Commands — Enterprise Pattern

### /pg — Pipeline Generator (TaskMastro 2.0)

```bash
/pg <spec-file>
```

Lê SPEC-\*.md, extrai tasks, gera/atualiza `tasks/pipeline.json`.

### /cursor-loop — Autonomous Loop

```bash
/computer-loop --resume   # Resume from checkpoint
/computer-loop --dry-run  # Simulate without changes
```

### /ship — End-of-Session Sync

```bash
/ship  # docs sync → commit → push both → merge main → new branch
```

---

## Tasks

### T1: Corrigir xargs echo sem quotes (C1)

**Ficheiro:** `scripts/cursor-loop-refactor.sh:208`

**Problema:**

```bash
# BEFORE (❌)
local changed_files; changed_files=$(git diff --cached --stat 2>/dev/null | tail -1 | sed 's/[[:space:]]*[[:digit:]]*[[:space:]]*file.*//' | xargs echo || echo 'auto fixes')
```

**Solução:**

```bash
# AFTER (✅)
local changed_files
changed_files=$(git diff --cached --stat 2>/dev/null | tail -1 | awk '{print $1}')
# fallback se awk falhar
[[ -z "$changed_files" || "$changed_files" == "file" ]] && changed_files="changes"
```

**Acceptance Criteria:**

- [ ] `xargs echo` removido
- [ ] Filenames com espaços não quebram commit msg
- [ ] `bash -n` passa sem erros

---

### T2: Corrigir sed strip incorrecto (C2)

**Ficheiro:** `scripts/cursor-loop-runner.sh:252`

**Problema:**

```bash
# BEFORE (❌) — sed 's/[[:space:]]*[[:digit:]]*[[:space:]]*file.*//'
# "myfile.ts" → "my" (strip too aggressive, matches "file" substring)
```

**Solução:**

```bash
# AFTER (✅)
local changed_files
changed_files=$(git diff --cached --stat 2>/dev/null | tail -1 | awk '{first=$1; gsub(/[^[:alnum:]._-]/,"_",first); print first}')
# Simpler: awk '{print $1}' — primeira coluna é o filename
```

**Acceptance Criteria:**

- [ ] `myfile.ts` não é truncado para `my`
- [ ] `my-super-file.ts` resulta em `my-super-file.ts`
- [ ] `bash -n` passa sem erros

---

### T3: Corrigir printf sem quotes (C3)

**Ficheiro:** `scripts/pipeline-state.sh:76`

**Problema:**

```bash
# BEFORE (❌)
if ! printf '%s\n' $valid_states | grep -qxF "$state"; then
```

**Solução:**

```bash
# AFTER (✅)
if ! printf '%s\n' "$valid_states" | grep -qxF "$state"; then
```

**Acceptance Criteria:**

- [ ] `valid_states` com quotes
- [ ] `bash -n` passa sem erros

---

### T4: Extrair MIN_SECRET_LEN para constante (S1)

**Ficheiro:** `scripts/bootstrap-check.sh`

**Problema:** Threshold 8 hardcoded no masking

**Solução:**

```bash
# AFTER (✅)
MIN_SECRET_LEN=8  # → topo do ficheiro como constante

elif [[ ${#value} -le $MIN_SECRET_LEN ]]; then
```

**Acceptance Criteria:**

- [ ] `MIN_SECRET_LEN=8` definido no topo
- [ ] Comment explicativo
- [ ] `bash -n` passa sem erros

---

### T5: qwen2.5vl:7b via env var (S2)

**Ficheiro:** `smoke-tests/smoke-multimodal-stack.sh:93`

**Problema:** Model name hardcoded

**Solução:**

```bash
# AFTER (✅)
# Anti-hardcoded: all config via process.env
VISION_MODEL="${OLLAMA_VISION_MODEL:-qwen2.5vl:7b}"
curl -s --max-time 5 http://localhost:11434/api/tags 2>/dev/null | grep -q "$VISION_MODEL"
```

**Acceptance Criteria:**

- [ ] `OLLAMA_VISION_MODEL` usado com fallback
- [ ] Comment `// Anti-hardcoded: all config via process.env`
- [ ] Script continua a funcionar

---

### T6: smoke-multimodal — 500/502 restored ou comment

**Ficheiro:** `smoke-tests/smoke-multimodal-stack.sh`

**Contexto:** Fix anterior removeu 500/502 dos códigos aceiteis — mas 500 pode ser válido para cold start.

**Solução:**

```bash
# AFTER (✅)
# 500 = Ollama cold start (model loading). 502 = gateway timeout.
# Estes são aceitáveis em smoke tests pois indicam routing OK.
[[ "$code" =~ ^(200|400|422|500|502)$ ]] \
  && ok "..." \
  || warn "..."
```

**Acceptance Criteria:**

- [ ] Comment que explica porquê 500/502 são aceites
- [ ] `bash -n` passa sem erros

---

### T7: Pipeline State — null handling robusto

**Ficheiro:** `scripts/pipeline-state.sh`

**Contexto:** `update_state_null` funciona, mas pode não ser chamada em todos os casos.

**Solução:**

```bash
# AFTER (✅)
# Verificar que null values são sempre passados como JSON null, não string "null"
cmd_approve() {
  update_state_null "blockedReason"   # ← usa função null
  update_state_null "blockedAt"
  update_state_null "humanGateReason"
  update_state "lastUnblockReason" "approved-by-cli"
}
```

**Acceptance Criteria:**

- [ ] Todas as chamadas de null usem `update_state_null`
- [ ] Não há `update_state "key" "null"` (string)
- [ ] `bash -n` passa sem erros

---

### T8: git add -A antes de git commit (C1+C2 stage fix)

**Ficheiro:** `scripts/cursor-loop-runner.sh`

**Contexto:** Se changes estão unstaged, `git diff --cached` retorna vazio.

**Solução:**

```bash
# AFTER (✅)
git add -A  # Stage tudo antes de check
git diff --cached --quiet 2>/dev/null && has_changes="false" || has_changes="true"
```

**Acceptance Criteria:**

- [ ] `git add -A` antes do check
- [ ] hasChanges reflecte o estado real
- [ ] `bash -n` passa sem erros

---

### T9: Validation smoke test final

**Ficheiro:** `smoke-tests/smoke-multimodal-stack.sh`

**Solução:**

```bash
# AFTER (✅) — Run smoke test e verificar que 0 failures
bash smoke-tests/smoke-multimodal-stack.sh 2>&1 | grep -c "FAIL"
# Deve retornar 0
```

**Acceptance Criteria:**

- [ ] Smoke test passa com 0 failures
- [ ] STT :8204 ✅
- [ ] TTS :8013 ✅
- [ ] Hermes :8642 ✅

---

## Execution Plan — 14 Agents + /cursor-loop

### Fase 1: /pg — Gerar pipeline

```bash
pg SPEC-056
```

Gera `tasks/pipeline.json` com T1-T9.

### Fase 2: /computer-loop — Aplicar fixes

```bash
/computer-loop --resume
```

O loop vai:

1. Research issues com MiniMax
2. Apply fixes (T1-T8)
3. Validate com smoke tests
4. Ship (commit + PR)

### Fase 3: Commit + Push

```bash
/ship
```

---

## Success Criteria

- [ ] T1: `xargs echo` → `awk '{print $1}'`
- [ ] T2: sed strip → `awk '{print $1}'`
- [ ] T3: `printf` → `printf '%s\n' "$valid_states"`
- [ ] T4: `MIN_SECRET_LEN=8` constante
- [ ] T5: `OLLAMA_VISION_MODEL` env var com fallback
- [ ] T6: 500/502 comment explanation
- [ ] T7: `update_state_null` para todos null fields
- [ ] T8: `git add -A` antes do check
- [ ] T9: Smoke test 0 failures
- [ ] Todos scripts passam `bash -n`
- [ ] Commit + PR criados

---

## Dependencies

- SPEC-056 criado (este doc)
- `tasks/pipeline.json` existente (de SPEC-051)
- `/computer-loop` funcional
- Smoke tests: STT :8204, TTS :8013, Hermes :8642 UP

---

## Risks

| Risco                           | Mitigação                                 |
| ------------------------------- | ----------------------------------------- |
| smoke test falha durante loop   | `--resume` do checkpoint                  |
| merge conflict em pipeline.json | manual resolution antes de /computer-loop |
| bash -n falso negativo          | validar manualmente após cada fix         |

---

## Files to Modify

| File                                    | Change     |
| --------------------------------------- | ---------- |
| `scripts/cursor-loop-refactor.sh`       | T1         |
| `scripts/cursor-loop-runner.sh`         | T2, T8     |
| `scripts/pipeline-state.sh`             | T3, T7     |
| `scripts/bootstrap-check.sh`            | T4         |
| `smoke-tests/smoke-multimodal-stack.sh` | T5, T6, T9 |

---

## References

- SPEC-051: OpenClaw Prune & Specs Polish
- SPEC-041: Monorepo Estado da Arte Polish
- Review findings: `docs/SPECS/reviews/REVIEW-20260416.md`
- Cursor-Loop: `scripts/cursor-loop-*.sh`
- Bootstrap: `scripts/bootstrap-check.sh`
