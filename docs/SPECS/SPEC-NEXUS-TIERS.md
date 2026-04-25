---
name: SPEC-NEXUS-TIERS
description: Nexus em multiplos niveis - MVP ate XL para refactoring
status: draft
owner: SRE-Platform
created: 2026-04-25
---

# SPEC-NEXUS-TIERS — Nexus Multi-Level Framework

## Problema

Nexus atual é unico para todos os casos. Precisamos de tiers diferentes para:
- MVP rápido (1-2 workers)
- Projetos pequenos e médios
- Projetos grandes (monorepo)
- Refactoring de projetos legados

## Tiers

### Tier 0: Nexus-MVP
- **Uso:** Funko individual, scripts, CLI simples
- **Workers:** 1-2
- **Spec:** <5 tasks
- **Execução:** ~5-15 min
- **Ideal:** fit.sh, scripts de automação

### Tier 1: Nexus-SM
- **Uso:** Projetos pequenos
- **Workers:** 3-5
- **Spec:** 5-15 tasks
- **Execução:** ~15-30 min
- **Ideal:** CLI tool nova, integração 1 API

### Tier 2: Nexus-MD
- **Uso:** Projetos médios
- **Workers:** 5-10
- **Spec:** 15-50 tasks
- **Execução:** ~30-90 min
- **Ideal:** API + frontend, múltiplas features

### Tier 3: Nexus-LG
- **Uso:** Projetos grandes
- **Workers:** 10-20
- **Spec:** 50-200 tasks
- **Execução:** ~1-4h
- **Ideal:** Monorepo, arquitetura complexa

### Tier 4: Nexus-XL (Refactoring)
- **Uso:** Refatoração de projetos legados
- **Workers:** 20-49 (max)
- **Spec:** Qualquer tamanho
- **Execução:** 4h+
- **Ideal:** Legacy → modern, re-arquitetura, documentação

## Arquitetura

```
nexus.sh
├── --tier mvp|sm|md|lg|xl
├── --workers N
└── --spec SPEC-XXX

nexus-helpers/
├── nexus-mvp.sh      # 1-2 workers, loop direto
├── nexus-sm.sh       # 3-5 workers, queue simples
├── nexus-md.sh       # 5-10 workers, queue + retry
├── nexus-lg.sh       # 10-20 workers, queue + retry + snapshot
└── nexus-xl.sh       # 20-49 workers, full features
```

## Features por Tier

| Feature | MVP | SM | MD | LG | XL |
|---------|----|----|----|----|-----|
| Loop básico | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate limiting | ❌ | ✅ | ✅ | ✅ | ✅ |
| Queue persist | ❌ | ❌ | ✅ | ✅ | ✅ |
| Auto-retry | ❌ | ❌ | ✅ | ✅ | ✅ |
| ZFS snapshot | ❌ | ❌ | ❌ | ✅ | ✅ |
| Context awareness | ❌ | ❌ | ❌ | ✅ | ✅ |
| Health check | ❌ | ❌ | ✅ | ✅ | ✅ |
| Mem0 integration | ❌ | ❌ | ❌ | ❌ | ✅ |

## Nexus Context Integration (XL)

```bash
# Para XL, integra com SPEC-CONTEXT-AUTO
nexus-xl.sh --spec SPEC-LEGACY-REFACTOR --context-aware
```

## Acceptance Criteria

1. nexus.sh --tier mvp executa com 1-2 workers
2. nexus.sh --tier xl executa com ate 49 workers
3. Cada tier tem thresholds apropriados
4. XL integra com context-auto.sh
5. Documentação clara de quando usar cada tier

## Migration

SPEC-999 (brain-refactor) foi nosso primeiro LG.
SPEC-FIT-MVP foi nosso primeiro MVP.
