---
name: Autopilot
description: Execução autónoma até task verificada completa
trigger: /autopilot, keep going, finish everything, continue, autonomous
version: 1.0.0
deprecated: false
---

# Autopilot Skill

Execução autónoma até a tarefa estar verificada completa. Não para até.

## Quando Usar

- Feature completa pronta para implementar
- Refactoring extenso
- Cuando queres que o agente continue até completeness
- Após `/spec` e `/pg` — o autopilot implementa o pipeline

## Como Executar

```bash
/autopilot
/autopilot --dry-run  # Simular sem fazer mudanças
/autopilot --resume    # Continuar de onde parou
```

## Fluxo

```
1. Verificar SPEC.md e pipeline.json
2. Para cada task pending:
   a. Build → Test → Verify
   b. Se falha: retry com backoff (1s, 2s, 4s, 8s...)
   c. Se stuck: pedir clarification
   d. Reportar progresso
3. Se todas completas → Done
```

## Retry Strategy

```bash
# Backoff exponencial
retry_count=0
until success; do
  delay=$((2 ** retry_count))
  sleep $delay
  retry_count=$((retry_count + 1))
  if [ $retry_count -gt 5 ]; then
    echo "Max retries exceeded - escalate to human"
    break
  fi
done
```

## Progress Reporting

A cada 5 minutos ou 10 tasks:

```markdown
## Progresso Autopilot

**Started:** {timestamp}
**Tasks completed:** {n}/{total}
**Errors:** {n}
**Current:** {task-name}

[TODO: next tasks...]
```

## Error Handling

| Situação | Acção |
|----------|-------|
| 3 falhas seguidas na mesma task | Escalar para humano |
| 10 errors total | Parar e reportar |
| Stuck (> 5min sem progresso) | Pedir clarification |
| Tarefa completa | Auto-commit |

## Safety Guards

❌ **Para se:**
- Humano intervém
- Erro de sintaxe críticos
- Perda de estado
- Conflictos de merge

✅ **Continua se:**
- Testes falham (até 3x por task)
- Lint warnings
- Não consegue encontrar ficheiro (procura alternatives)

## Diferença de outros comandos

| Cmd | Comportamento |
|-----|---------------|
| `/autopilot` | Não para até done, retry automático |
| `/execute` | 14 agentes em paralelo, mais complexo |
| `/build` | Uma task de cada vez, para após cada |
