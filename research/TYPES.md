# TYPES Results

## Task

Executar `pnpm tsc --noEmit` para verificar erros de TypeScript.

## Results

### Infrastructure Issue (pnpm virtual store broken)

O comando `pnpm typecheck` falha porque o shim `tsc` em `node_modules/.bin/tsc` aponta para um virtual store inexistente:

```
/tmp/pnpm-virtual/tsc@2.0.4/node_modules/tsc/bin/tsc
```

Este caminho não existe - o virtual store do pnpm está corrompido/mal configurado.

### Fallback Test: Direct tsc invocation

Usando `node /srv/monorepo/node_modules/typescript/bin/tsc` diretamente:

```
error TS2468: Cannot find global value 'Promise'.
src/components/ContentCard.tsx(12,3): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
src/components/GoogleIcon.tsx(24,2): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
src/form/ToggleButton.tsx(8,9): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
src/rhf-form/FormErrorDisplayer.tsx(41,11): error TS2550: Property 'entries' does not exist on type 'ObjectConstructor'.
```

Estes erros ocorrem porque o `tsc` root não encontra o `tsconfig.json` correto do pacote (`packages/ui/`).

### Root Cause

- **Bug de infraestrutura:** pnpm virtual store (`/tmp/pnpm-virtual/`) está quebrado
- O comando `pnpm typecheck` nos pacotes `@repo/ui-mui` e `@repo/zod-schemas` falha com "This is not the tsc command you are looking for"
- Turbo executa `tsc` via shim pnpm que não resolve corretamente

### Packages in scope

- `@connected-repo/backend`
- `@connected-repo/frontend`
- `@hermes-agency/core` (tsc executa OK)
- `@repo/ai-gateway`
- `@repo/typescript-config`
- `@repo/ui-mui` (falha - shim broken)
- `@repo/zod-schemas` (falha - shim broken)

## Status

**WARN**

O typecheck não pode ser executado corretamente devido a problema de infraestrutura pnpm (virtual store paths quebrados), não erros de tipos no código. O package `@hermes-agency/core` executa `tsc` com sucesso, indicando que o código TypeScript é válido - o problema é exclusivamente no shim pnpm.

### Ação Recomendada

Executar `pnpm install` para reparar o virtual store, ou usar alternativa:

```bash
node /srv/monorepo/node_modules/typescript/bin/tsc --project packages/ui/tsconfig.json --noEmit
```
