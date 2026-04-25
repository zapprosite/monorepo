---
name: Ideias
description: Gera ideias para o projeto —brainstorming, validacao, proximos passos
trigger: /ideias, brainstorm, generate ideas, what's next, suggest features
version: 1.0.0
deprecated: false
---

# Ideias Skill

Gera ideias para o projeto. Brainstorming estruturado com validacao rapida.

## Quando Usar

- Tens uma ideia mas nao sabes por onde comecar
- Precisas de sugestoes para o roadmap
- Apos `/survey` para explorar oportunidades
- Sprint planning ou retrospetiva

## O que faz

1. **Analisa contexto** — Lê SPEC.md, survey, recent commits
2. **Brainstorm** — Gera ideias basadas em gaps e oportunidades
3. **Valida** — Avalia impacto vs effort
4. **Prioriza** — Ranking por valor estrategico
5. **Propoe** — Next steps concretos

## Como Executar

```bash
/ideias
/ideias "melhorar performance"
/ideias --context api-design
```

## Output

```markdown
## Ideias Geradas — {date}

### High Priority (High Impact + Low Effort)
1. **Cache de API** — Adicionar Redis cache
   - Impacto: Alto | Effort: Baixo
   - Tempo estimado: 2h

2. **Retry Logic** — Exponential backoff em chamadas externas
   - Impacto: Medio | Effort: Baixo
   - Tempo estimado: 1h

### Medium Priority
3. **Dashboard de metricas** — Prometheus + Grafana
   - Impacto: Alto | Effort: Alto
   - Tempo estimado: 8h

4. **Rate Limiting** — Proteger API de abuse
   - Impacto: Medio | Effort: Medio
   - Tempo estimado: 4h

### Considerar Depois
5. **GraphQL migration** — Substituir REST
6. **Microservices split** — Separar dominios

---

## Proximos Passos Recomendados

1. Comecar com **Cache de API** (quick win)
2. Depois **Retry Logic** (resilience)
3. Planejar **Rate Limiting** para proximo sprint
```

## Fontes de Inspiracao

- SPEC.md actual e proximos passos
- `/survey` para gaps na arquitetura
- Commits recentes para dor-points
- Tech radar / trends do mercado

## Bounded Context

**Faz:**
- Brainstorming estruturado
- Validacao rapida de ideias
- Ranking por impacto/esforco

**Nao faz:**
- Implementacao (use `/spec` + `/planejar`)
- Decisoes arquiteturais (use `/decide`)
- Commitment de roadmap
