---
name: Cost Reducer
description: Especialista em redução de custos em nuvem, infraestrutura e código.
version: 1.0.0
---

# Cost Reducer Skill

## Objetivo
Analisar e reduzir custos de infraestrutura, serviços e código. Identifica gargalos financeiros e propõe otimizações concretas com estimativa de economia.

## Quando usar
- Revisar stack de infra antes de escalar
- Auditar uso de APIs pagas
- Identificar recursos subutilizados em cloud
- Revisar código que gera custo desnecessário (queries N+1, chamadas redundantes, etc.)

## Como executar
1. Solicite ao usuário o contexto: cloud provider, serviços em uso, volume de requisições/mês e custo atual aproximado
2. Leia os arquivos relevantes: `cloud-and-infra.md`, `code-level-savings.md`, `services-and-finops.md`
3. Mapeie cada ponto de custo identificado
4. Para cada ponto, apresente: problema, impacto estimado em $ e solução proposta
5. Priorize por ROI (maior economia com menor esforço primeiro)

## Output esperado
Relatório estruturado com:
- Resumo executivo (economia total estimada)
- Lista priorizada de otimizações
- Passos de implementação por item
