---
name: MCP Health
description: Diagnostica todos os MCP servers
trigger: /mcp
---

# MCP Health Skill

Diagnostica o estado de todos os MCP servers configurados.

## MCP Servers

| Server | Status | Latency | Notes |
|--------|--------|---------|-------|
| filesystem | ? | ?ms | |
| git | ? | ?ms | |
| context7 | ? | ?ms | |
| memory-keeper | ? | ?ms | |
| github | ? | ?ms | |
| playwright | ? | ?ms | |

## Checks

1. Server responds to ping
2. Authentication valid
3. Rate limits OK
4. Latency under threshold

## Output

```markdown
## MCP Health Check

**Timestamp:** YYYY-MM-DD HH:mm
**Total:** 6 servers

| Server | Status | Latency | Issue |
|--------|--------|---------|-------|
| filesystem | ✅ UP | 12ms | — |
| git | ✅ UP | 45ms | — |
| context7 | ⚠️ DEGRADED | 890ms | High latency |
| github | ❌ DOWN | — | Auth expired |

### Actions Required
1. Renew GitHub MCP auth token
2. context7 latency > 500ms — investigate
```

## Regras

1. Executar diariamente via cron (8h)
2. Degradado ≠ down — documenta
3. Auth issues → priority fix
