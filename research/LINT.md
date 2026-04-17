# LINT Results

## Task

Executar `pnpm lint` para validação SUPER-REVIEW (2026-04-17)

## Results

```
pnpm lint → Exit code 1
```

### Packages Affected

| Package           | Status                                               |
| ----------------- | ---------------------------------------------------- |
| @repo/ai-gateway  | ✅ PASS (cache hit)                                  |
| @repo/ui-mui      | ❌ FAIL — Formatação (double quotes → single quotes) |
| @repo/zod-schemas | ❌ FAIL — package.json e arquivos .ts format         |

### Errors Detected

**@repo/ui-mui:**

- 9+ arquivos com formatação inconsistente (double quotes vs single quotes em exports)
- Exemplos: `Avatar.ts`, `Badge.ts`, `Chip.ts`, `DialogActions.ts`, `DialogContent.ts`, `DialogTitle.ts`, `LinearProgress.ts`

**@repo/zod-schemas:**

- `package.json` — indentação/formatação
- `address.zod.ts` — import quotes
- Vários arquivos de teste com aspas duplas vs simples

## Status

**FAIL** — 2 de 7 packages com erros de lint

## Ação Requerida

Executar `pnpm lint --fix` para corrigir formatação automaticamente, ou corrigir manualmente:

- Usar aspas simples (`'`) ao invés de aspas duplas (`"`) em imports/exports
- Corrigir indentação do package.json
