---
description: Cria estrutura de novo app ou package no monorepo.
---

Cria estrutura de novo app ou package no monorepo.
Uso: /scaffold <tipo> <nome>
Tipos: app | package

Passos:
1. mkdir -p apps/<nome> ou packages/<nome>
2. cp packages/config/package.json apps/<nome>/package.json ou packages/<nome>/package.json
3. Adicionar tsconfig.json herdando de @repo/config
4. Criar src/index.ts inicial
5. if grep -q '"packages/<nome>"' pnpm-workspace.yaml; then :; else echo '"packages/<nome>": "workspace:*"' >> pnpm-workspace.yaml; fi
6. Rodar pnpm install
7. git add -A && git commit -m "feat: scaffold <tipo> <nome>"
