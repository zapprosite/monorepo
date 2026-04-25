---
name: SPEC-CONTEXT-AUTO
description: Context window auto-management para Claude Code CLI com Mem0/Qdrant
status: active
owner: SRE-Platform
created: 2026-04-25
---

# SPEC-CONTEXT-AUTO — Context Window Auto-Management

## Problema

1. Claude Code CLI comprime contexto automaticamente (/compact) - perde detalhes
2. Não detecta proativamente quando está próximo de 100%
3. Não calcula se a próxima task cabe no restante da janela
4. Mem0 e Qdrant existem mas não estão integrados no fluxo

## Numeros

```
200K tokens   - Context window total (claude-opus-4-7)
100K tokens   - Context window (claude-sonnet-4-6)
32K tokens    - Context window (claude-haiku-4-5)
200 tokens    - Mem0 search overhead
~1.5K tokens - System prompt + CLAUDE.md overhead
```

## Arquitetura

```
context-auto.sh
├── context-meter.sh      → Mede usage atual
├── context-predict.sh   → Prediz se próxima task cabe
├── context-snapshot.sh   → Snapshot para Mem0/Qdrant
├── context-decide.sh     → Decisão: proceed / compress / checkpoint
└── nexus-context-wrap.sh → Wrapper Nexus com context awareness
```

## Funcionalidades

### F1: Context Meter
```bash
# Retorna percentage e tokens usados
./context-meter.sh
# Output: "75% 150000 tokens"
```

### F2: Model Detection
```bash
# Detecta modelo atual do provider
./context-auto.sh --detect-model
# Output: "claude-opus-4-7" ou "MiniMax-M2.7"
```

### F3: Task Complexity Estimator
```bash
# Estima tokens necessários para uma task
./context-auto.sh --estimate "implement user auth with JWT"
# Output: "~3500 tokens"
```

### F4: Proactive Snapshot
```bash
# Se > 70%, snapshot automático para Mem0
./context-auto.sh --snapshot "TASK: user-auth-spec"
# Salva em Mem0 com namespace context-snapshots
```

### F5: Decision Engine
```bash
# Decisão: proceed | checkpoint | compress
./context-auto.sh --decide
# Lê threshold, calcula, retorna decisão
```

### F6: Nexus Integration
```bash
# Wrapper que诗意 envolvolve nexus.sh com context awareness
./nexus-context-wrap.sh --spec SPEC-XXX --phase execute
```

## Decision Thresholds

| Usage | Decision | Action |
|-------|----------|--------|
| 0-70% | ✅ proceed | Executa task normalmente |
| 70-85% | ⚠️ snapshot | Salva checkpoint em Mem0 antes de continuar |
| 85-95% | 🛑 decide | Calcula se task cabe; se não, /compact |
| 95-100% | 🔴 stop | Finaliza task atual, salva, próxima task aguarda |

## Integration with Mem0/Qdrant

### Mem0 (Agent Memory)
```python
# Namespace: context-snapshots
{
  "task": "user-auth-spec",
  "spec": "SPEC-XXX",
  "phase": "execute",
  "context_tokens": 145000,
  "snapshot_time": "2026-04-25T19:00:00Z",
  "summary": "Implemented JWT auth flow..."
}
```

### Qdrant (Knowledge Base)
```json
{
  "vector": [...],
  "payload": {
    "type": "context-snapshot",
    "task_id": "T01",
    "spec": "SPEC-XXX",
    "file_changes": ["src/auth/jwt.py", "tests/auth/test_jwt.py"],
    "last_commit": "abc123"
  }
}
```

## Tasks

### T1: Create context-meter.sh
- Detecta modelo via settings.json ou env
- Calcula tokens usados via conversation estimation
- Retorna percentage e contagens

### T2: Create context-predict.sh
- Analisa task description
- Estima tokens necessários (system prompt + task + expected output)
- Compara com remaining context

### T3: Create context-snapshot.sh
- Salva estado atual em Mem0
- Indexa em Qdrant com metadata
- Gera summary da conversa

### T4: Create context-decide.sh
- Decision engine com thresholds
- Lógica: proceed | snapshot | compress | stop
- Integra todos os outros scripts

### T5: Create nexus-context-wrap.sh
- Wrapper para nexus.sh
- Hooks de context-awareness
- Auto-snapshot antes de cada task

### T6: Integrate with cron
- Adicionar ao nexus-cron-helper.sh
- Health check inclui context check

## Nexus Integration

```bash
# No nexus.sh, antes de cada task:
source /srv/monorepo/scripts/context-decide.sh
decide=$(context_decide)
if [ "$decide" = "stop" ]; then
  # Finaliza loop atual, agenda próximo
  exit 0
elif [ "$decide" = "snapshot" ]; then
  context_snapshot "task_$task_id"
fi
```

## Acceptance Criteria

1. context-meter.sh retorna percentage preciso
2. context-decide.sh respeita thresholds
3. Snapshot salva em Mem0 com namespace correto
4. nexus-context-wrap.sh não adiciona latência > 100ms
5. 0 compressões de contexto em 50 tasks executadas
6. Mem0 search retorna snapshots corretos após /new

## Tech Stack

- Bash scripts (Shell)
- Mem0 MCP (memory layer)
- Qdrant (vector search)
- jq (JSON processing)

## References

- SPEC-SPEC-AUTOMATOR.md (context budget monitor)
- ai-context-sync/ (existente em ~/.claude/mcps/)
