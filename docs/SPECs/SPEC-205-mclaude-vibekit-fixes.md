---
name: SPEC-205
description: Corrigir 4 bugs críticos: vibe-kit.sh zombies, runner.ts watchdog, api-models.ts timeout, i18n/context.tsx render loop
status: draft
owner: will
created: 2026-04-29
---

# SPEC-205 — mclaude + vibe-kit Critical Bug Fixes

## Problema

4 bugs independentes causando travamentos, zombies e loops infinitos:

1. **vibe-kit.sh** — não faz `waitpid()`, workers completam mas processo-pai não sabe, causando acúmulo de zombies
2. **runner.ts** — `spawn()` sem watchdog, se Claude travar o processo fica pendente eternamente em 100% CPU
3. **api-models.ts** — `fetchApiModels` sem `AbortSignal`, chamadas lentas penduram indefinidamente
4. **i18n/context.tsx** — `I18nProvider` sem `useMemo`, objeto de contexto recriado a cada render causando re-render cascade

## Solução

### Fix 1 — vibe-kit.sh: waitpid() + TASK_TIMEOUT

**Arquivo**: `/srv/monorepo/.claude/vibe-kit/vibe-kit.sh`

**Mudanças**:
- Adicionar `MAX_TASK_TIME` (default: 10min) — timeout por task
- Adicionar `wait_task()` — loop com `waitpid()` não-bloqueante que detecta exit codes
- Substituir `spawn_worker()` de background-subprocess para `spawn_worker()` com watchdog
- Quando `wait_task()` detecta exit code != 0, marcar task como `failed`
- Quando `wait_task()` detecta timeout, fazer `kill -9` no PID e marcar como `failed`
- Ao final do while-loop principal, fazer `wait` em todos os PIDs pendentes

**Acceptance Criteria**:
- [ ] Workers que completam são corretamente marcados `done` com exit code
- [ ] Workers que excedem `MAX_TASK_TIME` são mortos com `kill -9` e marcados `failed`
- [ ] Nenhum processo órfão fica vivo após o vibe-kit.sh terminar
- [ ] `vibe-kit.log` registra: start, exit code, timeout events

### Fix 2 — runner.ts: watchdog timeout

**Arquivo**: `/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/runner.ts`

**Mudanças**:
- Adicionar `const TASK_TIMEOUT_MS = 30_000` (30 segundos)
- Em `runClaude()`: envolver o `child` spawn em um watchdog
- Watchdog: `setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000); }, TASK_TIMEOUT_MS)`
- Antes de fazer `resolve(code)`, fazer `clearTimeout(watchdog)` — só mata se não resolver
- Log: `log.warn("child exceeded timeout, killing")`

**Acceptance Criteria**:
- [ ] Processo Claude que não responde por >30s é morto automaticamente
- [ ] Processo Claude normal (termina em <30s) não é afetado
- [ ] Exit code reportado corretamente como `124` (timeout) ou `1` (erro)

### Fix 3 — api-models.ts: AbortSignal.timeout

**Arquivo**: `/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/services/api-models.ts`

**Mudanças**:
- Adicionar `signal: AbortSignal.timeout(10_000)` na chamada `fetch()` em `fetchApiModels()`
- Tratar `AbortError` — retornar `Result` com erro `network` (não `auth`)
- Em `hasApiModelFetching()`, já fazer check rápido antes de chamar `fetch`

**Acceptance Criteria**:
- [ ] Chamadas que demoram >10s retornam erro `network` em vez de pendurar
- [ ] Erro `network` é mostrado corretamente na UI como "Network error"
- [ ] Tests cobrem timeout path

### Fix 4 — i18n/context.tsx: useMemo no value

**Arquivo**: `/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/i18n/context.tsx`

**Mudanças**:
- Importar `useMemo` de `react`
- Mudar `const value: I18nContextValue = {...}` para `const value = useMemo(() => ({...}), [])`
- Garantir que `useCallback` dos handlers em `UnifiedApp` não dependem de `t` diretamente (extrair `t` para fora dos deps se necessário)

**Acceptance Criteria**:
- [ ] `I18nProvider` re-renderiza filhos apenas quando `locale` muda
- [ ] `useTranslation()` retorna `t` e `locale` estáveis entre renders
- [ ] Nenhum novo re-render chain quando componente pai faz update de estado

## Pipeline

### Fase 1 — Análise (4 tasks, paralelas)
| Task | Arquivo | Descrição |
|------|---------|-----------|
| T1-ANALYZE | vibe-kit.sh | Analisar loop principal, identificar pontos de waitpid |
| T2-ANALYZE | runner.ts | Analisar spawn + close event, desenhar watchdog |
| T3-ANALYZE | api-models.ts | Localizar fetchApiModels, mapear todos call sites |
| T4-ANALYZE | i18n/context.tsx | Mapear todos consumers de I18nProvider |

### Fase 2 — Implementação (4 tasks, paralelas, dependem de análise)
| Task | Depende | Descrição |
|------|---------|-----------|
| T5-IMPL | T1 | Implementar wait_task() + watchdog + timeout em vibe-kit.sh |
| T6-IMPL | T2 | Implementar watchdog timeout em runner.ts |
| T7-IMPL | T3 | Implementar AbortSignal.timeout em api-models.ts |
| T8-IMPL | T4 | Implementar useMemo em I18nProvider |

### Fase 3 — Teste e Validação (4 tasks, dependem de implementação)
| Task | Depende | Descrição |
|------|---------|-----------|
| T9-TEST | T5 | Testar vibe-kit.sh: workers que terminam, workers que timeout |
| T10-TEST | T6 | Testar runner.ts: processo normal vs processo que hanga |
| T11-TEST | T7 | Testar api-models.ts: fetch normal vs fetch timeout |
| T12-TEST | T8 | Testar i18n/context.tsx: re-renders medidos antes vs depois |

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| vibe-kit.sh regressão em waitpid | Média | Alta | Testar com workers existentes antes de merge |
| runner.ts watchdog mata processo prematuramente | Baixa | Média | Timeout alto (30s), só mata se não sair |
| api-models.ts quebra existing tests | Baixa | Média | Só adiciona timeout, não muda contract |
| i18n/context.tsx muda поведение de locale | Baixa | Alta | Verificar todos consumers |

##Arquivos a Modificar

```
/srv/monorepo/.claude/vibe-kit/vibe-kit.sh          [Fix 1]
/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/runner.ts      [Fix 2]
/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/services/api-models.ts [Fix 3]
/home/will/.bun/install/global/node_modules/@leogomide/multi-claude/src/i18n/context.tsx    [Fix 4]
```

## Deps Externas

- Nenhuma — todas mudanças são in-place, sem novos packages
