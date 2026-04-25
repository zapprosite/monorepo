---
name: estado-sistema
description: Status completo do sistema
trigger: /estado-sistema
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /estado-sistema — Estado do Sistema

## Quando Usar
- Verificação rápida de saúde
- Antes de iniciar trabalho
- Após problemas

## O que Verifica

### Hermes (Bot de IA)
| Check | Status |
|-------|--------|
| /health | ✅/❌ |
| /ready | ✅/❌ |
| smoke tests | ✅/❌ |

### Nexus (Executor)
| Check | Status |
|-------|--------|
| Workers | X active |
| Queue | Y pending |
| Rate | Z RPM |

### Mem0 (Memory)
| Check | Status |
|-------|--------|
| Qdrant | ✅/❌ |
| Collections | X active |
| Memory DB | ✅/❌ |

### Sistema
| Check | Status |
|-------|--------|
| Processes | X/4096 |
| Disk | XX% free |
| Memory | XX% free |

## Como Usar

```
/estado-sistema
```

## Exemplo de Saída

```
┌─────────────────────────────────────┐
│ 🌡️ ESTADO DO SISTEMA               │
├─────────────────────────────────────┤
│ Hermes   ✅ 3/3 smoke OK           │
│ Nexus    ✅ 8 workers, 45 RPM      │
│ Mem0     ✅ 13 collections          │
│ Qdrant   ✅ 18h uptime              │
├─────────────────────────────────────┤
│ OS         423/4096 processes      │
│ Disk       65% free (93GB)          │
│ Memory     54% free (16GB)          │
└─────────────────────────────────────┘
```