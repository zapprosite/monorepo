# SPEC-SRE-001: Estado da Arte SRE em 7 dias
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab

**Data:** 2026-05-02  
**Status:** Ativa  
**Escopo:** monorepo Zappro, Nexus, GitHub Actions primário, Gitea como espelho/fallback  
**Modo de automação:** diagnosticar e propor; nenhuma mutação em produção sem aprovação humana

## Objetivo

Elevar a operação para um nível SRE pragmático em 7 dias: menos surpresa, mais evidência, deploy com gate humano, smoke reproduzível e um caminho claro para corrigir dívida técnica sem bloquear toda entrega útil.

O alvo inicial de disponibilidade é **99,5% para serviços críticos**. Esse número é o contrato operacional de partida, não uma promessa de marketing. Ele deve ser medido por checks de saúde read-only e revisado quando houver métricas históricas suficientes.

## Serviços críticos

| Serviço | Tier | Exposição | Health esperado |
|---|---:|---:|---|
| API | critical | público | `https://api.zappro.site` ou `/health` local |
| Hermes | critical | público | `/health` |
| Chat | critical | público | página ou `/health` |
| LiteLLM | critical | auth-gated | 2xx ou 401/403 esperado |
| Qdrant | critical | privado | local saudável; público não é requisito |
| Git | important | público | página acessível |
| Coolify | important | público | API/página acessível |
| pgAdmin | important | público | página acessível |
| Gym | best_effort | público | não bloqueia SLO crítico |

## Contrato de health

Novos serviços devem expor, nessa ordem de preferência:

1. `/health`: processo vivo e dependências mínimas.
2. `/health/ready`: pronto para receber tráfego.
3. `/health/detailed`: diagnóstico autenticado ou interno, sem segredos.

Serviços privados não precisam de endpoint público. Falha de DNS público em serviço privado não deve ser classificada como incidente se o endpoint local/autenticado estiver saudável.

## Comando operacional

`scripts/sre-check.sh` é o contrato único para smoke SRE:

```bash
scripts/sre-check.sh ci --json
scripts/sre-check.sh local --markdown
scripts/sre-check.sh prod-readonly --json
```

Regras:

- `ci`: não consulta produção; valida contrato mínimo do repositório.
- `local`: consulta endpoints locais e portas locais.
- `prod-readonly`: consulta endpoints públicos quando aplicável e endpoints locais para serviços privados.
- saída JSON é estável para automação.
- saída Markdown é para resumo humano em CI/deploy.
- código de saída diferente de zero só ocorre quando check crítico fica `unhealthy` ou `unknown`.

## GitHub primário

GitHub Actions é o CI primário. Gitea permanece como espelho/fallback e não deve aparecer como contexto obrigatório em workflows GitHub.

Pipeline mínimo:

1. instalar com pnpm e Node 22.
2. validar `scripts/sre-check.sh ci --json`.
3. rodar lint Biome.
4. rodar testes unitários/smoke já estabilizados.
5. publicar resumo com dívida técnica conhecida.

Deploy para produção exige environment approval. Falha pós-deploy não dispara rollback automático nesta fase; o workflow deve diagnosticar, registrar evidência e apontar para rollback manual aprovado.

## Critérios de aceite

- `python3 -m pytest tests/test_sre_check.py -q` passa.
- `scripts/sre-check.sh ci --json` passa.
- `scripts/sre-check.sh prod-readonly --markdown` gera relatório sem mutação.
- `.github/workflows/ci.yml` usa GitHub, pnpm e SRE contract.
- `.github/workflows/deploy-main.yml` usa GitHub, pnpm, gate humano e smoke SRE read-only.

## Próximas decisões

- Manter backend integration em `pnpm --filter @connected-repo/backend test:integration` com PostgreSQL/`DB_*` declarados.
- Aplicar as regras Prometheus propostas quando houver exporter consolidado.
- Decidir com approval humano se Gym deve ser restaurado, removido do catálogo público ou mantido best-effort.

## Estado em 2026-05-02

- `pnpm check-types`: verde no monorepo.
- `pnpm lint`: verde, com avisos informativos não bloqueantes no `ai-gateway`.
- Stable tests: `ai-gateway`, backend unitário, `zod-schemas` e frontend verdes.
- Health: API e AI Gateway expõem `/health`, `/health/ready` e `/health/detailed` sem segredos.
- Produção read-only: serviços críticos saudáveis; `gym.zappro.site` permanece `best_effort` e não bloqueante.
- SLO: 99.5% inicial documentado em `docs/OPERATIONS/SLO-BURN-RATE.md`.
