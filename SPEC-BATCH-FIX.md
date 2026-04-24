# SPEC-BATCH-FIX — Critical Issues Batch (2026-04-23)

## Objetivo
Resolver 9 problemas críticos em paralelo usando 18 agents.

## issues Prioritárias

| # | Problema | Impacto | Agentes |
|---|----------|---------|---------|
| 1 | 203 git branches | TOO MANY, meta <30 | 2 |
| 2 | cloudflared SPOF | Todos subdomains caem | 2 |
| 3 | 6.5GB models sem backup | Perda total se disco encher | 2 |
| 4 | git gc.log + loose objects | Corrupção gradual | 2 |
| 6 | Mem0 collection mismatch | Embeddings no lugar errado | 2 |
| 7 | Logs sem rotação | Disco cheio em weeks | 2 |
| 8 | RUNBOOK.md untested | Disaster recovery não funciona | 2 |
| 9 | .env tracking | Mudanças não rastreadas | 2 |

## Comportamento Esperado
- Cada par de agents resolve seu problema
- Commit ao final com mensagem clara
- Push para origin
- Reporto final com o que foi feito

## Definição de Pronto
- [ ] 203 branches → <30
- [ ] cloudflared com failover configurado
- [ ] Backup de models em /srv/backups/models/
- [ ] git gc.log limpo, loose objects removidos
- [ ] Mem0 collections consistentes
- [ ] logrotate configurado para /srv/ops/logs
- [ ] RUNBOOK.md procedures testadas
- [ ] .env tracking resolvido (gitignore ou backup)
