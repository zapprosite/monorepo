# Quality Review — 2026-04-26

**Scope:** `/srv/monorepo/apps/` (api, ai-gateway, monitoring), `/srv/monorepo/scripts/`, `/srv/monorepo/.claude/vibe-kit/`, `AGENTS.md`, `CLAUDE.md`

---

## Findings

### [HIGH] vibe-kit — `--queue` flag silenciosamente ignorado em nexus.sh

**File:** `.claude/vibe-kit/nexus.sh:376`

```
bash "${WORKDIR}/vibe-kit.sh" --queue "${QUEUE_FILE}" --parallel "${parallel}"
```

O `vibe-kit.sh` não reconhece o parâmetro `--queue`. O script só aceita:
- argumento posicional (spec file)
- `--hours`
- `--parallel`

O `QUEUE_FILE` é lido via variável de ambiente (`QUEUE_FILE="${QUEUE_FILE:-}"` no vibe-kit.sh), não do argumento `--queue`. O argumento `--queue` é desconhecido e ignorado silenciosamente via `set -euo pipefail`? Não — `getopts` não é usado, os args.unknown são simplesmente descatados. **O queue file usado será sempre o default `$VIBE_DIR/queue.json`.**

Se nexus.sh e vibe-kit.sh forem usados em workflows mistos, podem operar em queues diferentes.

**Fix:** Adicionar `--queue` ao parsing de args em `vibe-kit.sh` ou usar `QUEUE_FILE=... vibe-kit.sh` em vez de `--queue ...`.

---

### [HIGH] vibe-kit — claim-task.py não existe no path esperado

**File:** `.claude/vibe-kit/vibe-kit.sh:196`

```
task_json=$(QUEUE_FILE="$QUEUE_FILE" python3 "$VIBE_DIR/claim-task.py" "$worker_id" 2>/dev/null)
```

O `claim-task.py` existe como symlink em `.claude/vibe-kit/claim-task.py` → `scripts/vibe/claim-task.py`. Contudo, se o working directory for diferente na altura do launch, `$VIBE_DIR` pode não resolver corretamente. O script usa `set -euo pipefail`, então se o ficheiro não existir ou falhar, o worker morre silenciosamente (`2>/dev/null`).

---

### [MEDIUM] FIXME: Error logging não funciona em apps/api/src/app.ts

**File:** `apps/api/src/trpc.ts:44`

```typescript
// FIXME: The present implementation send the correct error to frontend but the error logging at apps/backend/src/app.ts is not working as expected.
```

Este FIXME indica que `console.log(error.cause)` e `console.log(error.stack)` estão comentados (linhas 45-46). Erros internos não estão a ser logados corretamente — dificulta debugging em produção.

---

### [MEDIUM] console.log em código de produção (seeds)

**Files:**
- `apps/api/src/db/seeds/slices-10-12.seed.ts:2,78`
- `apps/api/src/db/seeds/kanban.seed.ts:4,71`
- `apps/api/src/db/seed/crm.seed.ts:4,9,167`
- `apps/api/src/db/seed/index.ts:7,17`
- `apps/api/src/db/seed/prompts.seed.ts:4,195`
- `apps/api/src/db/seed/dev-team.seed.ts:28`
- `apps/api/src/middlewares/errorHandler.ts:120`

Seeds com `console.log` poluem stdout e podem expôr dados em contextos de build/CI. Deveriam usar o logger do Fastify ou outro structured logger.

---

### [MEDIUM] TODO em session security middleware

**File:** `apps/api/src/middlewares/sessionSecurity.middleware.ts:183`

```typescript
// TODO: Optional enhancement - Send email to user about suspicious activity
```

Should be tracked as an issue, not commented in code.

---

### [MEDIUM] ai-gateway auth — timing attack mitigado mas sem testes

**File:** `apps/ai-gateway/src/middleware/auth.ts`

O uso de `timingSafeEqual` com `padEnd` está correto para mitigar timing attacks. Porém, o ficheiro não tem testes e o `catch` no try-block (linha 28) come erros silenciosamente, tratando-os como invalid token. Isto é razoável para auth, mas deveria ter cobertura de testes.

---

### [LOW] state.json e .vibe-kit.lock no git working tree

**File:** `.claude/vibe-kit/state.json`, `.claude/vibe-kit/.vibe-kit.lock`

Ambos estão tracked pelo git (modified no git status). Estes são ficheiros de estado de runtime que nunca deveriam ser commitados. `.vibe-kit.lock` contém apenas `3512220` (um PID?), o que confirma ser estado efémero.

**Fix:** Adicionar ao `.gitignore`:
```
.claude/vibe-kit/state.json
.claude/vibe-kit/.vibe-kit.lock
.claude/vibe-kit/queue.json
```

---

### [LOW] kanban — TODO para plataforma de observabilidade

**File:** `apps/api/src/modules/kanban/kanban.logging.ts:106`

```typescript
// TODO: Send to observability platform (DataDog, New Relic, etc)
```

Sem linked issue. Mesmo que seja futuro, deveria estar no tracker, não no código.

---

### [LOW] nexus.sh — duplicate code block

**File:** `.claude/vibe-kit/nexus.sh:375-381`

O bloco `if [[ -x "${WORKDIR}/vibe-kit.sh" ]]; then` aparece duplicado dentro da função `phase_execute()`. O segundo é unreachable code.Lines 375 e 381 são literalmente o mesmo.

---

### [LOW] CLAUDE.md e AGENTS.md duplicados

Ambos os ficheiros têm conteúdo quase idêntico (`CLAUDE.md` e `AGENTS.md`). A únicos diferenças relevantes são:
- `AGENTS.md` menciona "AI Context Sync" no topo
- `CLAUDE.md` tem "Quick Commands" + "Security Rules" mais detalhados

Ter dois ficheiros com 95% de overlap causa confusão sobre qual é a fonte de verdade. `AGENTS.md` deveria ser um stub que referencia `CLAUDE.md`, ou os dois deveriam ser fundidos.

---

## Recommendations

1. **Adicionar `--queue` support em vibe-kit.sh** — Ou usar `QUEUE_FILE=...` como env var em vez de argumento, e garantir que nexus.sh passa assim.

2. **Criar um .gitignore mínimo para .claude/vibe-kit/** — `state.json`, `.vibe-kit.lock`, `queue.json`, `logs/` nunca devem ser commitados.

3. **Remover console.log de seeds** — Usar `app.log.info()` do Fastify ou um logger estruturado. Seeds são código de produção (ou pelo menos CI-adjacent).

4. **Criar issue para o FIXME de error logging** — `apps/api/src/trpc.ts:44` é um bug real que dificulta debugging. Deve ser fixado ou documentado como known limitation.

5. **Remover unreachable code em nexus.sh:375-381** — Bloco duplicado dentro de `phase_execute()`.

6. **Consolidar CLAUDE.md e AGENTS.md** — Ou um é stub do outro, ou fundir num único ficheiro com todas as secções.

7. **Converter TODOs em issues** — `sessionSecurity.middleware.ts:183` e `kanban.logging.ts:106` devem estar no tracker, não como comentários.

8. **Verificar claim-task.py symlink em todos os contextos** — O symlink funciona se `.claude/vibe-kit/` for o CWD, mas pode falhar em contextos de script calling via absolute path.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 4 |

**Risk:** O bug `--queue` ignorado é o mais crítico — pode causar workers a operar em queues erradas em workflows mistos nexus/vibe-kit. O FIXME de error logging afecta debuggability em produção.
