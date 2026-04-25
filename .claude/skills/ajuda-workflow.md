---
name: ajuda-workflow
description: Explica workflow completo e como usar
trigger: /ajuda-workflow
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /ajuda-workflow — Guia de Workflow

## Quando Usar
- Primeira vez no projeto
- Não sabe por onde começar
- Confuso com comandos

## Fluxo Padrão

```
IDEIA → /spec → /plan → /execute → /review → /ship
  ↓        ↓       ↓         ↓         ↓       ↓
 [?]    criar    criar    executar   avaliar  enviar
      espec.    tarefas     workers   resultado
```

## Comandos Principais

| Comando | Quando | O que faz |
|---------|--------|-----------|
| `/tutor` | Estou perdido | Detecta contexto e sugere |
| `/onde-estamos` | Quero perspectiva | Mostra estado atual |
| `/proximo-passo` | Terminei tarefa | Sugere o que fazer |
| `/spec` | Preciso documentar ideia | Cria SPEC.md |
| `/plan` | Tenho ideia e preciso planejar | Cria tarefas |
| `/execute` | Tenho plano e quero ir | Executa com workers |
| `/build` | Quero implementar incremental | Executa uma task |
| `/review` | Terminei, preciso revisar | Analisa código |
| `/ship` | Pronto para finalizar | Commit + push + merge |

## Sistema de Ajuda

1. **Confuso?** → `/tutor`
2. **Perdido?** → `/onde-estamos`
3. **Bloqueado?** → `/proximo-passo`

## Como Começar

```
1. /tutor           ← para orientação inicial
2. /onde-estamos     ← para ver onde está
3. /proximo-passo   ← para saber o que fazer
```

## Recursos

- Docs PT-BR: `.claude/docs-ptbr/`
- SRE Dashboard: `SRE-DASHBOARD.md`
- Quick Ref: `QUICKREF_pt-BR.md`
