# Comece Aqui

**Objetivo:** reduzir a salada operacional do monorepo. Este arquivo é o ponto de entrada para humano ou agente antes de mexer em código, docs, CI ou produção.

## Verdade Atual

| Tema | Verdade operacional |
|---|---|
| Package manager | `pnpm` |
| CI primário | GitHub Actions |
| Gitea | espelho/fallback, não fonte primária de CI |
| Smoke SRE | `scripts/sre-check.sh` |
| Deploy produção | GitHub workflow com approval humano |
| Automação em produção | `diagnose_only`: diagnostica e propõe; não muta sem aprovação humana |
| Plano SRE | [SPEC-SRE-001-estado-da-arte-7d.md](./SPECS/SPEC-SRE-001-estado-da-arte-7d.md) |

## Se Você Está Perdido

1. Leia este arquivo.
2. Rode `bash scripts/sre-check.sh ci --json` para validar o contrato local do repo.
3. Rode `bash scripts/sre-check.sh prod-readonly --markdown` para ver saúde operacional sem mutar produção.
4. Use a skill `.claude/skills/monorepo-navigator/SKILL.md` para descobrir onde mexer.
5. Use a skill `.claude/skills/sre-operator/SKILL.md` para health, incidente, deploy ou rollback.

## Onde Mexer

| Objetivo | Local provável | Primeiro comando |
|---|---|---|
| API/backend | `apps/api` | `pnpm --filter @connected-repo/backend test` |
| Web/frontend | `apps/web` | `pnpm --filter @connected-repo/frontend test` |
| AI Gateway | `apps/ai-gateway` | `pnpm --filter @repo/ai-gateway test` |
| Schemas | `packages/zod-schemas` | `pnpm --filter @connected-repo/zod-schemas test` |
| UI compartilhada | `packages/ui` | `pnpm --filter @repo/ui-mui lint` |
| CI/deploy | `.github/workflows` | `bash scripts/sre-check.sh ci --json` |
| Operação/SRE | `docs/OPERATIONS` e `scripts/sre-check.sh` | `bash scripts/sre-check.sh prod-readonly --markdown` |

## O Que Não Usar Como Verdade Primária

- Docs históricas que contradizem runtime atual.
- SPECs antigas fora do índice ativo.
- Workflows Gitea como fonte primária de CI.
- Scripts que fazem mutação em produção sem approval.
- Status aspiracional em README antigo sem smoke recente.

Quando houver conflito, a ordem de confiança é:

1. Smoke executável e runtime atual.
2. `SPEC-SRE-001`.
3. `AGENTS.md` e este `START-HERE`.
4. README e índices atualizados.
5. Docs históricas apenas como contexto.

## Comandos Canônicos

```bash
pnpm install
pnpm lint
python3 -m pytest tests/test_sre_check.py tests/test_monorepo_orientation.py -q
bash scripts/sre-check.sh ci --json
bash scripts/sre-check.sh prod-readonly --markdown
```

## Próxima Camada de Polimento

- Manter `pnpm check-types` como gate estrito.
- Manter testes backend unitários no gate estável e integração em comando explícito com PostgreSQL.
- Remover ou arquivar docs históricas duplicadas somente com rastro em índice.
- Padronizar `/health`, `/health/ready` e `/health/detailed` por serviço.
- Manter skills por fluxo, não por tecnologia solta.
