---
name: debug-ajuda
description: Ajuda com debugging e problemas
trigger: /debug-ajuda
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /debug-ajuda — Debugging Help

## Quando Usar
- Algo não funciona
- Erro inesperado
- Bug inexplicável

## Fluxo de Debug

```
Problema → /debug-ajuda → Identificar → Corrigir
```

## Comandos de Debug

| Situação | Comando | O que faz |
|----------|---------|-----------|
| Bug geral | `/universal-debug` | 4 fases sistemáticas |
| Problema no código | `/code-review` | Analisa e sugere |
| Segurança | `/security-review` | Audit de vulnerabilidades |
| Erro específico | `/bug-investigation` | Investigação profunda |

## Como Usar

```
/debug-ajuda
```

## Exemplo de Saída

```
🔧 DEBUG HELP

Situação: Erro no Hermes Gateway

Comandos disponíveis:
  /universal-debug     ← para bugs gerais
  /code-review         ← para análise de código
  /security-review     ← para problemas de segurança

Recomendação: /universal-debug

Próximo passo:
  1. Reproduzir erro
  2. Isolar causa
  3. Entender contexto
  4. Aplicar correção
```

## Dicas

1. **Erro inesperado?** → `/universal-debug`
2. **Código está lento?** → `/code-review`
3. **Suspeita de segurança?** → `/security-review`
4. **Não sabe a causa?** → `/bug-investigation`
