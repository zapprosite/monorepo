---
name: navegar
description: Navegação entre contexts e SPECs
trigger: /navegar
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /navegar — Navegar Entre Contextos

## Quando Usar
- Quer trocar de SPEC
- Precisa cambiar de projeto
- Quer revisar SPEC anterior

## O que Faz

1. Lista SPECs disponíveis
2. Mostra estado de cada uma
3. Permite trocar contexto

## Como Usar

```
/navegar
```

## Exemplo de Saída

```
🧭 NAVEGAR ENTRE SPECs

  1. SPEC-999  [active]     Execute phase   (5 tasks)
  2. SPEC-204  [completed]   Complete         (12/12 done)
  3. SPEC-200  [draft]       Plan phase       (0 tasks)

Selecione номер: [1-3]
```

## Ações

| Ação | Resultado |
|------|-----------|
| `1` | Troca para SPEC-999 |
| `2` | Troca para SPEC-204 (read-only) |
| `3` | Troca para SPEC-200 |

## Ele NÃO faz
- Não modifica SPEC
- Não cria tasks
- Não executa nada
