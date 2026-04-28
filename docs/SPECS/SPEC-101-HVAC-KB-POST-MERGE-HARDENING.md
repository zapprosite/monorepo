---
name: SPEC-101
description: Corrigir 3 P1s pós-merge hvac-kb + mover scripts para git
status: active
owner: nexus-orchestrator
created: 2026-04-28
---

# SPEC-101 — HVAC-KB Post-Merge Hardening

## Problema

Após review de merge da branch `hvac-kb-test-responses` em `hvacr-swarm`, 3 problemas P1 foram identificados e precisam ser corrigidos antes do merge ou como follow-up imediato:

1. **Qdrant auth header errado** — usa `Authorization: Bearer` mas Qdrant usa `api-key`
2. **Healthcheck mascara falhas** — skip do Qdrant retorna `status: pass` em vez de `warn`
3. **Falso positivo em termos OOD curtos** — substring match em `test`, `bla`, `tv` etc.

Além disso, scripts estão em `/srv/data/hvac-rag/scripts/` (fora do git) e precisam ser migrados.

## Solução

Três correções P1 + migração de scripts para `hvacr-swarm/scripts/hvac-rag/`.

## Funcionalidade

### P1-1: Corrigir header de autenticação Qdrant

Arquivos afetados:
- `hvac-rag-pipe.py` (linha ~61)
- `hvac-qdrant-query.py` (linha ~23)

**Antes:**
```python
def qdrant_headers():
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}
```

**Depois:**
```python
def qdrant_headers():
    headers = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        headers["api-key"] = QDRANT_API_KEY
    return headers
```

### P1-2: Healthcheck — skip retorna warn, não pass

Se `QDRANT_API_KEY` não está definido, o healthcheck não deve retornar `status: pass` com `skipped: true`. Deve retornar `status: warn` e incluir `reason: qdrant_api_key_not_set`. O overall pode ser `pass` apenas se `QDRANT_AUTH_DISABLED=true` estiver explícito no ambiente.

Criar `/srv/hvacr-swarm/scripts/hvac-rag/hvac-healthcheck.py` com lógica corrigida.

### P1-3: Termos OOD curtos com word boundary

No `hvac-juiz.py` (ainda não encontrado — pode já ter sido corrigido na branch), substituir:

```python
if term in text_lower
```

Por regex com word boundary `\b` ou lista de termos exatos.

### P2: Mover scripts para git

Mover:
- `/srv/data/hvac-rag/scripts/hvac-rag-pipe.py` → `hvacr-swarm/scripts/hvac-rag/hvac-rag-pipe.py`
- `/srv/data/hvac-rag/scripts/hvac-qdrant-query.py` → `hvacr-swarm/scripts/hvac-rag/hvac-qdrant-query.py`
- Criar novo `hvacr-swarm/scripts/hvac-rag/hvac-healthcheck.py` com lógica P1-2

## Acceptance Criteria

- [ ] `hvac-rag-pipe.py` usa `api-key` header para Qdrant
- [ ] `hvac-qdrant-query.py` usa `api-key` header para Qdrant
- [ ] Healthcheck retorna `warn` quando Qdrant key ausente
- [ ] Termos OOD curtos não causam falso positivo
- [ ] Scripts vivem em `hvacr-swarm/scripts/hvac-rag/` (git tracked)
- [ ] `python3 -m py_compile` passa em todos os scripts

## Arquivos de Saída

- `hvacr-swarm/scripts/hvac-rag/hvac-rag-pipe.py` (corrigido)
- `hvacr-swarm/scripts/hvac-rag/hvac-qdrant-query.py` (corrigido)
- `hvacr-swarm/scripts/hvac-rag/hvac-healthcheck.py` (novo)

## Riscos

- Qdrant local sem auth vai continuar funcionando (sem header é 200)
- Scripts em `/srv/data` perdem histórico git se movidos — fazer commit antes de mover
