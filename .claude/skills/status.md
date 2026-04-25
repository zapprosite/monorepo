---
trigger: /status
purpose: Verificar estado do Nexus
when: Preciso saber se está tudo OK
---

# /status — Verificar Estado do Nexus

## Proposito
Verificar se o Nexus esta operacional e listar o estado de todos os servicos e agentes.

## Quando Usar
- "Preciso saber se está tudo OK"
- "O Nexus está respondendo?"
- Check antes de iniciar trabalho

## Verificacoes

### 1. Servicos Ativos
```bash
ps aux | grep -E "nexus|hermes|mem0|postgres|redis" | grep -v grep
```

### 2. Status do Nexus Framework
```bash
cd /srv/monorepo && .claude/vibe-kit/nexus.sh status 2>/dev/null || echo "Nexus not available"
```

### 3. Health Endpoints
```bash
curl -s http://localhost:8000/health 2>/dev/null || echo "Hermes unreachable"
curl -s http://localhost:8001/health 2>/dev/null || echo "Mem0 unreachable"
```

### 4. Uptime dos Servicos
```bash
uptime && echo "---" && pgrep -a hermes | head -1
```

## Output Esperado

```
=== Nexus Status ===

[SERVICOS]
- Hermes Gateway:  RUNNING/STOPPED (PID: XXXXX)
- Mem0 Server:    RUNNING/STOPPED (PID: XXXXX)
- Postgres:       RUNNING/STOPPED (PID: XXXXX)
- Redis:          RUNNING/STOPPED (PID: XXXXX)

[AGENTES]
- Nexus Framework: 7×7=49 agentes
- Active Sessions:  X

[RECURSOS]
- CPU: XX%
- Memory: XX%
- Disk: XX%

RESULTADO: OK/WARNING/CRITICAL
```
