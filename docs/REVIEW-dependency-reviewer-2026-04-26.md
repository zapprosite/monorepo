# Dependency Review — 2026-04-26

**Agent:** dependency-auditor (vibe-kit)
**Scope:** /srv/monorepo (apps/, scripts/, .claude/vibe-kit/, AGENTS.md, CLAUDE.md)

---

## Findings

### 1. CRÍTICO — Zod v3 vs v4 Version Conflict

**Arquivo:** `apps/ai-gateway/package.json:20`

```json
"zod": "^3.24.1"   // Zod v3 (legacy)
```

**Problema:** `packages/zod-schemas` especifica `zod@^4.1.12` como peer dependency. Zod v3 e v4 têm breaking changes significativos (API incompatível). O `ai-gateway` importa de `@repo/zod-schemas` que espera Zod v4, mas declara Zod v3 como sua própria dependency.

**Impacto:** Potential runtime errors ou incompatibilidade de tipos entre `ai-gateway` e `zod-schemas`.

---

### 2. ALTO — Deprecated `tsc` Package (Redundante)

**Arquivo:** `package.json:42`

```json
"tsc": "^2.0.4"
```

**Problema:** `tsc@2.0.4` é um pacote deprecated que é apenas um thin wrapper em torno do TypeScript. O projeto já tem `typescript@5.9.3` em devDependencies. O `tsc` package não é usado em nenhum script de build — os scripts usam `typescript` diretamente ou `tsx`.

**Impacto:**manutenção desnecessária, potential confusion. `tsc` v2.0.4 (2017) vs `typescript` v5.9.3 (2025).

---

### 3. MÉDIO — 8 Outdated Dev Dependencies

```
Package                                Current  Latest
@biomejs/biome (dev)                   2.4.11   2.4.13
@typescript-eslint/eslint-plugin (dev)  8.58.2   8.59.0
@typescript-eslint/parser (dev)         8.58.2   8.59.0
@eslint/js (dev)                       9.39.4   10.0.1
eslint (dev)                           9.39.4   10.2.1
globals (dev)                           15.15.0  17.5.0
lint-staged (dev)                       15.5.2  16.4.0
typescript (dev)                        5.9.3    6.0.3
```

**Arquivo:** `package.json` (root)

**Problema:** Patch/minor updates disponíveis com correções de bugs e segurança. `typescript@6.0.3` é major update com breaking changes em relação a 5.x.

**Nota:** Nenhuma vulnerabilidade encontrada (`pnpm audit`: "No known vulnerabilities found").

---

### 4. MÉDIO — `packages/config` É Apenas Meta (Sem Dependencies)

**Arquivo:** `packages/config/package.json`

Este package não contém nenhuma dependency real — apenas define TypeScript configs (`tsconfig.json`) exports. Está correto como workspace metadata package, mas não precisa de `clean` script que referencia `node_modules` inexistente.

---

### 5. BAIXO — Vibe-Kit State Parado em "looping" com task "idle"

**Arquivo:** `.claude/vibe-kit/state.json`

```json
{ "phase": "looping", "current_task": "idle", "elapsed_seconds": 0 }
```

**Problema:** O estado indica que o vibe-kit está em modo "looping" mas sem tasks ativos (`idle`). O queue.json está vazio (sem tasks pendentes). Parece que o loop terminou ou está ocioso sem trabalho.

---

### 6. BAIXO — `apps/monitoring` Não Tem package.json

**Arquivo:** `apps/monitoring/` não existe em `package.json` workspaces ou não tem `package.json`.

Verificado: `ls /srv/monorepo/apps/` retorna `ai-gateway  api  monitoring` mas `apps/monitoring` não tem `package.json` — não é um workspace package, apenas uma pasta.

---

## Recommendations

### 1. Fix Zod Version Conflict (CRÍTICO)

```bash
# Remover zod@^3.24.1 do ai-gateway — ele deve herdar zod@4 do workspace
pnpm remove zod --filter @repo/ai-gateway
# O @repo/zod-schemas já declara zod como peer dependency, então será usado
```

Ou, se Zod v3 for intencionalmente necessário no ai-gateway por alguma razão legacy, documentar e isolar o usage.

### 2. Remover `tsc` Package Redundante (ALTO)

```bash
pnpm remove tsc
```

Verificar antes se algum script usa `tsc` diretamente como binário — grep apenas `typescript` e `tsx` são usados nos scripts de build.

### 3. Atualizar Dev Dependencies (MÉDIO)

```bash
# Atualizar em batches para evitar breaking changes
pnpm up -r --filter ./packages/* @biomejs/biome @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm up --filter ./packages/* @eslint/js eslint globals lint-staged
```

**Atenção:** `typescript@6.0.3` requer avaliação — verificar breaking changes antes de atualizar. Recomenda-se atualizar para 5.x latest primeiro (5.9.3 → 5.9.x).

### 4. Investigar Vibe-Kit State (BAIXO)

```bash
cat .claude/vibe-kit/state.json
# Verificar se o loop precisa ser reiniciado ou se o trabalho está completo
```

Se todas as tasks estão "done", o estado deveria refletir `phase: "complete"` ou similar.

### 5. Documentar `apps/monitoring` (BAIXO)

Se `apps/monitoring` é intencionalmente um diretório sem package.json (para configs, dashboards, etc.), adicionar um `README.md` ou mover para `infra/monitoring/` para evitar confusão com workspace packages.

---

## Summary

| Severity | Count |
|----------|-------|
| CRÍTICO   | 1     |
| ALTO      | 1     |
| MÉDIO     | 2     |
| BAIXO     | 2     |
| **Total** | **6** |

**Vulnerabilidades:** 0 (pnpm audit clean)
**Licenças:** Não verificadas (sem `license-checker` configurado)

---

*Gerado por: dependency-auditor (vibe-kit) | 2026-04-26*
