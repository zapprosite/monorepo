---
name: second-brain-loader
type: skill
description: Carrega contexto do Second Brain antes de tarefas
trigger: second-brain | carregar contexto | sb
---

# Second Brain Loader

Carrega o contexto do Hermes Second Brain antes de qualquer tarefa.

## Uso

`/second-brain-loader` — carrega todos os contextos

## Fluxo

1. `cat ~/.hermes/sb-context.md`
2. Se não existir: `bash ~/.hermes/scripts/sb-boot.sh`
3. Procurar secção: `grep -A 50 "apps/" ~/.hermes/sb-context.md`

## Sincronizar

`bash /srv/monorepo/scripts/sync-second-brain.sh`
