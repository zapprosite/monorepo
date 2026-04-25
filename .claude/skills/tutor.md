---
name: tutor
description: Detecta contexto e sugere próximo passo automaticamente
trigger: /tutor
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /tutor — Tutor Inteligente do Monorepo

## Quando Usar
- Você está perdido e não sabe o que fazer
- Quer sugestões do que vem a seguir
- Precisa de orientação sobre workflow

## O que Faz

1. **Detecta contexto atual**
   - Lê queue.json se existir
   - Verifica SPECs ativas
   - Analisa estado do projeto

2. **Mostra situação**
   - Onde estamos no workflow
   - O que está pendente
   - O que está bloqueado

3. **Sugere próximo passo**
   - Recomenda comando específico
   - Explica por que é a melhor opção
   - Oferece executar

## Como Usar

```
/tutor
```

## Exemplo de Saída

```
📍 LOCALIZAÇÃO
   SPEC: SPEC-999 (active)
   Fase: Plan → Execute
   Tasks: 3 pending, 0 running

🎯 RECOMENDAÇÃO
   Comando: /execute
   Motivo: SPEC está pronta, tarefas pendentes
   Alternativa: /plan (se quiser rever plano)

💡 PRÓXIMO PASSO
   /execute --parallel 8
```

## Ele NÃO faz
- Não executa sem sua aprovação
- Não modifica arquivos
- Não toma decisões por você

## Dica
Use `/tutor` sempre que ficar perdido.