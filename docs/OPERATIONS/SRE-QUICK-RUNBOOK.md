# Runbook Rápido SRE

Use este runbook quando a pergunta for: "o sistema está saudável?", "deploy pode seguir?", "algo caiu?" ou "preciso de evidência antes de mexer".

## Regra Principal

Produção é `diagnose_only` por padrão. O agente pode coletar evidência e propor ação, mas não deve reiniciar serviço, mudar config, rodar rollback, alterar DNS, firewall, ZFS ou deploy sem aprovação humana explícita.

## Health Geral

```bash
bash scripts/sre-check.sh prod-readonly --markdown
```

Contrato de health para serviços mantidos neste monorepo:

| Endpoint | Uso | Pode expor segredo? |
|---|---|---|
| `/health` | liveness simples | não |
| `/health/ready` | readiness para deploy/roteamento | não |
| `/health/detailed` | diagnóstico seguro sem credenciais | não |

Interpretação:

| Status | Ação |
|---|---|
| `healthy` | seguir fluxo normal |
| `degraded` | identificar serviço não crítico ou best-effort; registrar evidência |
| `unhealthy` | se serviço crítico falhou, abrir investigação antes de deploy |

## CI Local

```bash
bash scripts/sre-check.sh ci --json
pnpm lint
pnpm check-types
pnpm --filter @connected-repo/backend test
python3 -m pytest tests/test_sre_check.py tests/test_monorepo_orientation.py -q
```

## Testes Backend

O comando padrão do backend é unitário e não exige PostgreSQL local:

```bash
pnpm --filter @connected-repo/backend test
```

Testes que exercitam tRPC/HTTP/DB ficam isolados no comando de integração:

```bash
pnpm --filter @connected-repo/backend test:integration
```

Use `test:integration` somente com PostgreSQL e variáveis `DB_*` declaradas.

## Deploy

1. GitHub Actions é o caminho primário.
2. O job de deploy exige environment approval.
3. O smoke pós-deploy usa `scripts/sre-check.sh prod-readonly --markdown`.
4. Falha pós-deploy não executa rollback automático nesta fase.
5. Rollback é workflow manual com motivo e approval.

## Incidente

1. Rode `bash scripts/sre-check.sh prod-readonly --markdown`.
2. Classifique serviço: `critical`, `important` ou `best_effort`.
3. Cole evidência no ticket/chat/incidente.
4. Consulte logs somente leitura.
5. Proponha ação mínima.
6. Peça aprovação antes de qualquer mutação.

## Casos Comuns

| Sintoma | Primeiro diagnóstico | Observação |
|---|---|---|
| Qdrant parece offline | `scripts/sre-check.sh prod-readonly --markdown` | Qdrant é privado/local; DNS público não é requisito |
| Gym falha | verificar se é `best_effort` | não bloqueia SLO crítico |
| CI vermelho | `bash scripts/sre-check.sh ci --json`, `pnpm lint`, `pnpm check-types` | integração backend exige PostgreSQL declarado |
| Deploy falhou | abrir summary do GitHub Actions | não executar rollback automático |

## Decisão Gym

`gym.zappro.site` está classificado como `best_effort`. Em 2026-05-02, o smoke `prod-readonly` retornou falha de DNS (`Name or service not known`) apenas para Gym, com API, Hermes, Chat, LLM, Qdrant, Git, Coolify e pgAdmin saudáveis. Portanto:

- não bloqueia deploy nem SLO crítico;
- não deve disparar rollback;
- restauração, remoção do catálogo público ou alteração DNS exigem aprovação humana explícita.

## SLO

O SLO inicial dos serviços críticos é 99.5% mensal, com proposta de burn-rate em `docs/OPERATIONS/SLO-BURN-RATE.md` e regras Prometheus em `prometheus/sre-burn-rate.rules.yml`.
