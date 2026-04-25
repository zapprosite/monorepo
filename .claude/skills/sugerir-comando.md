---
name: sugerir-comando
description: Dado contexto, sugere melhor comando
trigger: /sugerir-comando
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /sugerir-comando — Qual Comando Devo Usar?

## Quando Usar
- Você sabe o que quer mas não sabe o comando
- Confuso entre opções similares

## Matriz de Decisão

| Você quer... | Use |
|--------------|-----|
| Criar especificação | `/spec` |
| Planejar implementação | `/plan` |
| Implementar incremental | `/build` |
| Executar many workers | `/execute` |
| Fazer testes primeiro | `/test` |
| Revisar código | `/review` |
| Finalizar e shippar | `/ship` |
| Debugar problema | `/universal-debug` |
| Gerar ideias | `/brainstorming` |
| Explorar código | `/survey` |

## Não Confunda

| Você pensou em... | Mas deveria usar... |
|-------------------|----------------------|
| `/plan` para criar SPEC | Use `/spec` |
| `/execute` para uma task | Use `/build` |
| `/ship` para deploy | Use `/deploy-check` |
| `/review` para debug | Use `/universal-debug` |

## Como Usar

```
/sugerir-comando [situação]
```

Exemplo:
```
/sugerir-comando Preciso adicionar uma feature nova
```

## Exemplo de Saída

```
🎯 COMANDO RECOMENDADO

Situação: Adicionar feature nova

Comando: /spec

Motivo: Para documentar requisitos antes de implementar

Alternativas:
  /plan      ← se já tiver requisitos claros
  /build     ← se quiser implementar direto (não recomendado)
```
