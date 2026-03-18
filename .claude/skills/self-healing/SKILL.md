---
name: Self-Healing
description: Especialista em aprendizado autônomo e correção automática.
version: 1.0.0
---

# Self-Healing Skill

## Objetivo
Fazer o Claude Code aprender com erros, criar novas skills automaticamente quando identifica padrões recorrentes e melhorar sua própria performance ao longo do tempo.

## Quando usar
- Após resolver um problema complexo que provavelmente vai se repetir
- Quando o Claude percebe que está usando o mesmo padrão em múltiplas situações
- Para criar documentação automaticamente de decisões técnicas tomadas

## Como executar

### Detectar padrão
1. Leia pattern-recognition.md para identificar se o problema atual é recorrente
2. Verifique se já existe skill para esse tipo de problema
3. Se não existe e o padrão é recorrente: crie a skill

### Criar skill automaticamente
1. Leia skill-creation-guide.md para o processo de criação
2. Extraia o aprendizado da sessão atual em formato de skill
3. Salve no diretório correto com nome descritivo

### Gerenciar memória
1. Leia memory-management.md para como persistir aprendizados
2. Documente decisões importantes para referência futura
3. Atualize skills existentes quando o aprendizado as contradiz

## Output esperado
- Nova skill criada quando padrão recorrente identificado
- Decisões técnicas documentadas automaticamente
- Melhoria progressiva: a segunda vez que o mesmo problema aparece, resolve mais rápido e melhor
