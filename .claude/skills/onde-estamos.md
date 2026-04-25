---
name: onde-estamos
description: Mostra localização atual no workflow
trigger: /onde-estamos
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /onde-estamos — Onde Estamos?

## Quando Usar
- Quer entender estado atual do projeto
- Não sabe em que fase está
- Quer perspectiva global

## O que Mostra

1. **SPEC atual**
   - Nome e status
   - Fase atual
   - Acceptance criteria pendentes

2. **Nexus status**
   - Tasks pending/running/done
   - Workers ativos
   - Taxa de execução

3. **Sistema**
   - Hermes: online/offline
   - Mem0: connected
   - Last activity

## Como Usar

```
/onde-estamos
```

## Exemplo de Saída

```
┌─────────────────────────────────────┐
│ 📍 ONDE ESTAMOS                     │
├─────────────────────────────────────┤
│ SPEC: SPEC-999                      │
│ Status: active                      │
│ Fase: Execute (P→R→E→V→C)          │
├─────────────────────────────────────┤
│ NEXUS                               │
│ Tasks: 12 pending | 3 running      │
│ Workers: 8 active                   │
│ Throughput: 45 RPM                  │
├─────────────────────────────────────┤
│ SISTEMA                              │
│ Hermes: ✅ online (3/3 smoke)        │
│ Mem0: ✅ connected (13 collections)   │
│ Last activity: 15 min ago            │
└─────────────────────────────────────┘
```
