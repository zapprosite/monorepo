---
name: minimax-debugger
description: Docker crash + tunnel + 529 error triage using MiniMax LLM with long-context log ingestion
trigger: /bug-triage
---

# MiniMax Debugger

## Objetivo

Diagnose complex Docker/tunnel/service crashes by ingesting full logs into MiniMax M2.7 (1M context) — no manual chunking, PT-BR native reasoning.

## Quando usar

- `docker ps` mostra container em Exit ou restart loop
- Cloudflared tunnel DOWN
- 529 API overload errors correlacionados entre servicos
- Smoke test falhou sem causa obvia

**Integra com:** `/bug` skill existente (invoca este como sub-agent para Docker/tunnel errors).

## Como usar

```
/bug-triage
```

Gather mode: interativo — pergunta qual container/servico investigar.

Ou com alvo direto:
```
/bug-triage loki
/bug-triage cloudflared
```

## Fluxo

```
/bug-triage <service>
  -> Coleta:
      docker logs <service> --tail 1000
      docker inspect <service> (exit code, restart count)
      df -h (disk pressure)
      zpool status tank (ZFS health)
      arc_summary -S (ZFS ARC usage — detecta OOM invisivel)
  -> Send para MiniMax
  -> Output JSON estruturado:
      {
        root_cause: "loki compact failed: disk 95%",
        confidence: 0.92,
        next_step: "prune loki wal files in /srv/docker-data/loki",
        prevention: "add disk >80% Prometheus alert"
      }
```

## Output esperado

```json
{
  "root_cause": "<causa raiz em PT-BR>",
  "confidence": 0.85,
  "next_step": "<acao imediata especifica>",
  "prevention": "<acao preventiva>",
  "restart_count": 3
}
```

## Bounded context

**Faz:**
- Ingere logs Docker completos (1M context — sem truncar)
- Detecta restart loops via `docker inspect` historico
- ZFS ARC exhaustion via `arc_summary` (complementa `zpool status`)
- Retorna JSON parseavel por scripts shell

**Nao faz:**
- Nao executa remediation automaticamente
- Nao reinicia servicos (requer aprovacao humana)
- Nao substitui `docker autoheal` para restart automatico

## Limitacoes conhecidas

- `health-check.log` e texto livre com emoji markers — MiniMax infere contexto via raciocinio
- `docker logs` em container que reiniciou mostra apenas a instancia atual — restart count via `docker inspect`

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- `docker`, `df`, `zpool`, `arc_summary` disponiveis no host
- Endpoint: `https://api.minimax.io/anthropic/v1`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Bug section)
- SPEC-034 Review: I-6 (arc_summary), I-7 (log format), S-2 (restart loop), S-3 (JSON bridge)
