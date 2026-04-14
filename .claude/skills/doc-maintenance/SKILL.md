---
name: doc-maintenance
description: Documentation sync and generation using MiniMax — API ref, ports drift, TSDoc, spec-fill
trigger: /dm
---

# Doc Maintenance

## Objetivo

Keep monorepo documentation in sync with the live codebase using MiniMax LLM — detect drift, generate API references, and fill SPECs.

## Quando usar

- After adding/removing tRPC procedures
- When PORTS.md or SUBDOMAINS.md may be out of date
- Functions lack TSDoc comments
- SPEC Decisions Log is empty

## Como usar

```
/dm api-ref       # Parse tRPC routers -> docs/REFERENCE/TRPC-API.md
/dm ports         # ss -tlnp vs PORTS.md diff -> report drift
/dm subdomains    # curl health vs SUBDOMAINS.md -> report DOWN/UP
/dm spec-fill     # SPEC-*.md + implementation -> populate Decisions Log
/dm tsdoc         # Scan modules/ for undocumented functions -> TSDoc
```

## Fluxo — /dm ports

```
/dm ports
  -> Run: ss -tlnp
  -> Read: /srv/ops/ai-governance/PORTS.md
  -> MiniMax compara portas ativas vs registradas
  -> Output: drift report (porta X ativa mas nao registrada)
  -> NOTE: porta drift nao e modificada automaticamente — requer aprovacao humana
```

## Fluxo — /dm api-ref

```
/dm api-ref
  -> Read: apps/api/src/routers/trpc.router.ts + all procedure files
  -> MiniMax gera tabela markdown com:
      - Procedure name, type (query/mutation), input schema, output
  -> Output: docs/REFERENCE/TRPC-API.md (atualiza ou cria)
```

## Output esperado

- `/dm ports` -> texto com portas em drift, sem modificacao automatica
- `/dm api-ref` -> `docs/REFERENCE/TRPC-API.md` atualizado
- `/dm tsdoc` -> comentarios TSDoc inlined no codigo
- `/dm spec-fill` -> secao "Decisions Log" preenchida no SPEC

## Bounded context

**Faz:**
- Detecta drift entre documentacao e sistema real
- Gera API reference de codigo fonte
- Adiciona TSDoc a funcoes sem documentacao

**Nao faz:**
- Nao modifica PORTS.md ou SUBDOMAINS.md automaticamente (requer aprovacao)
- Nao cria SPEC do zero (use `/spec`)
- Nao faz deploy ou restart de servicos

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`
- `ss` disponivel no host para `/dm ports`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Doc section)
- SPEC-034 Review: C-5 — `/dm ports` aponta para `PORTS.md`, nao `SERVICE_STATE.md`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`
