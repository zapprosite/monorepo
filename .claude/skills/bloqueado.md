---
name: bloqueado
description: Ajuda quando você está travado
trigger: /bloqueado
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /bloqueado — Estou Travado

## Quando Usar
- Não sabe o que fazer
- Parece que nada funciona
- Desanimado

## Soluções por Situação

### Situação 1: Não sei o que fazer
→ `/tutor`
Ele detecta contexto e sugere caminho

### Situação 2: Sei o que fazer mas não consigo
→ `/proximo-passo`
Sugere próxima ação simples

### Situação 3: Comando não funciona
→ `/resumo-comandos`
Verifica se está usando comando certo

### Situação 4: Esqueci onde estou
→ `/onde-estamos`
Mostra estado atual e contexto

### Situação 5: Erro misterioso
→ `/debug-ajuda`
Indica caminho de debug

## Fluxo de Desbloqueio

```
😰 BLOQUEADO
    ↓
/bloqueado
    ↓
[identifica situação]
    ↓
[sugere comando específico]
    ↓
[executa e resolve]
```

## Lembre-se

1. **Você não está sozinho** — `/tutor` ajuda
2. **Passo a passo** — faça uma coisa de cada vez
3. **Peça ajuda** — não precisa saber tudo

## Como Usar

```
/bloqueado
```