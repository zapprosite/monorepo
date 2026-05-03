---
name: SPEC-210
description: Enterprise-grade hardening for single-node homelab — version pinning, backup integrity, SLO tracking, IaC unification, incident playbooks
status: IN_PROGRESS
priority: critical
author: will-zappro
date: 2026-05-03
specRef: SPEC-009-homelab-seguro-estavel.md, SPEC-200-hermes-ecosystem-architecture.md, SPEC-008-ZFS-SECONDARY-DISK-ENTERPRISE.md
---

# SPEC-210 — Enterprise Homelab Hardening

## Objective

Transformar o homelab single-node Ubuntu Desktop (SRV) de **lab state** para **enterprise state** — versões travadas, zero breakage por atualização automática, backup verificável, SLOs mensuráveis, e Hermes como cuidador autónomo.

---

## 1. Diagnosis: O que está correto sobre SRV + Ubuntu Desktop

A escolha de usar **single-node Ubuntu Desktop** é correta para este contexto:

| Factor | Avaliação | Rationale |
|--------|-----------|-----------|
| **Single node físico** | ✅ Correto | Orçamento R$25k, sem segundo node. ZFS on NVMe Gen5 fornece confiabilidade de armazenamento. |
| **Ubuntu Desktop** | ✅ Correto | GPU drivers (RTX 4090) funcionam natively. Ollama + Qwen2.5-VL precisam de ambiente gráfico para vision. Alternativa (Ubuntu Server) traria overhead de configurar headless GPU. |
| **Docker + systemd** | ✅ Correto | Containers para isolamento, systemd para persistência. Não precisa de K8s — single node, não escala horizontalmente. |
| **ZFS como único filesystem** | ✅ Correto | Snapshots atómicos, scrub automático, compressão. 4TB Gen5 NVMe — IO não é gargalo. |
| **Cloudflare Tunnel** | ✅ Correto | Zero port forwarding. Terraform IaC para subdomínios. Melhor que VPN para este caso (clientless, Cloudflare Access integrado). |
| **Coolify como orchestrator** | ✅ Correto | Simplifica deploy sem precisar de K8s. Web UI para deploys manuais quando necessário. |

### ⚠️ O que NÃO está correto

| Problema | Severidade | Impacto |
|----------|-----------|---------|
| **15+ imagens Docker com tag `:latest`** | 🔴 Critical | Atualização automática pode quebrar serviços silenciosamente. Sem rollback deterministico. |
| **3 serviços de backup com falha** | 🔴 Critical | Janela de perda de dados. Backup incremental + Qdrant + snapshot com services disabled. |
| **Sem verificação de restore** | 🔴 Critical | Backups existem mas nunca foram testados. Backup sem restore testado = não é backup. |
| **Sem offsite backup** | 🟡 High | ZFS local é excelente, mas falha catastrófica do NVMe perde tudo. 3-2-1 rule não cumprida. |
| **Sem Alertmanager receivers configurados** | 🟡 High | Alertas existem no Prometheus mas ninguém recebe. |
| **Sem SLOs definidos** | 🟡 High | Não sabemos se 99.5% uptime é aceitável ou não. |
| **Docker compose stacks fragmentadas** | 🟡 Medium | 6+ compose stacks separadas. Sem source of truth unificado. |
| **Sem WAF rules** | 🟡 Medium | Cloudflare protege mas sem regras customizadas. |
| **Sem runbooks de incidente** | 🟡 Medium | Se algo quebrar às 3am, não há procedimento documentado. |

---

## 2. Definição de Enterprise para Este Contexto

Enterprise NÃO significa multi-node, K8s, ou 5-nines. Significa:

| Pillar | Lab State (onde estamos) | Enterprise State (onde queremos chegar) |
|--------|--------------------------|----------------------------------------|
| **Versões** | `:latest` tags, qualquer versão | Digest pinning SHA256, manifest auditado |
| **Backup** | Snapshots existem, restore nunca testado | Restore automatizado e verificado a cada 7 dias |
| **Monitoring** | Prometheus + Grafana sem alertas | Alertmanager → Telegram via Hermes, SLO dashboards |
| **Incidentes** | Debug ad-hoc | Runbooks + Hermes auto-diagnóstico Tier 1 |
| **Deploy** | Coolify manual ou Gitea Actions | GitOps: git push → CI → deploy → smoke test → verify |
| **Security** | UFW + fail2ban + Cloudflare básico | WAF rules, vulnerability scan semanal, audit log |
| **IaC** | Terraform só para Cloudflare | Docker compose unificado + Terraform completo |
| **Docs** | HOMELAB.md (reality) | Runbooks + dependency map + DR plan |

---

## 3. Roadmap

### Fase 1: Foundation — Pin Everything (Urgente, ~4h)
```
Prazo: 2026-05-04
Impacto: Elimina risco de quebra por atualização automática
```

**Tarefas:**
- [ ] **T1.1** Criar `docs/REFERENCE/VERSIONS.md` — manifesto de versões com digests SHA256 para todas as 21 imagens Docker + Ollama models
- [ ] **T1.2** Atualizar docker-compose files removendo todas as tags `:latest` e substituindo por `image@sha256:...`
- [ ] **T1.3** Criar `scripts/docker-digest-audit.sh` — CI check que falha se detectar `:latest` ou `:nightly` em qualquer compose file
- [ ] **T1.4** Adicionar `docker-digest-audit.sh` ao cron diário (Hermes reporta via Telegram)
- [ ] **T1.5** Congelar versões de Ollama models: criar `models/MODEL_MANIFEST.md` com hashes dos blobs

### Fase 2: Backup Integrity (Crítico, ~6h)
```
Prazo: 2026-05-05
Impacto: Elimina risco de backup fantasmas
```

**Tarefas:**
- [ ] **T2.1** Reparar 3 serviços de backup com falha (`hermes-backup-snapshot`, `hermes-backup-incremental`, `hermes-backup-qdrant`)
- [ ] **T2.2** Criar `scripts/backup-verify.sh` — faz restore de cada tipo de backup em diretório temp e verifica integridade
- [ ] **T2.3** Agendar `backup-verify.sh` via cron semanal (domingo 10:00) com report via Telegram
- [ ] **T2.4** Documentar runbook `docs/RUNBOOKS/restore-procedures.md` com passo-a-passo para cada tipo de restore
- [ ] **T2.5** Avaliar offsite backup: rclone para B2 Backblaze ou bucket S3-compatible (~$6/mês para 250GB)

### Fase 3: Monitoring + SLO (Importante, ~4h)
```
Prazo: 2026-05-07
Impacto: Passa de "monitorar" para "saber antes de quebrar"
```

**Tarefas:**
- [ ] **T3.1** Configurar Alertmanager receivers para Telegram (via Hermes bot API)
- [ ] **T3.2** Definir SLOs para serviços críticos:
  | Service | SLO Target | Error Budget (30d) |
  |---------|-----------|---------------------|
  | Gitea (`git.zappro.site`) | 99.5% | 3h 36min |
  | Coolify (`coolify.zappro.site`) | 99.0% | 7h 12min |
  | Qdrant | 99.9% | 43min |
  | Ollama | 99.5% | 3h 36min |
  | LiteLLM (`llm.zappro.site`) | 99.5% | 3h 36min |
  | Hermes Gateway | 99.0% | 7h 12min |
- [ ] **T3.3** Criar Prometheus recording rules para SLO compliance (SLI: `up{job=~".*"}` → burn rate alerts)
- [ ] **T3.4** Adicionar Grafana dashboard "Enterprise Overview" com: uptime %, error budget queimado, top alerts, disk usage trend
- [ ] **T3.5** Criar `scripts/synthetic-prober.sh` — prober HTTP que testa todos os 13 subdomínios a cada 5 min

### Fase 4: IaC Unification (Médio, ~6h)
```
Prazo: 2026-05-10
Impacto: Single source of truth para toda infra
```

**Tarefas:**
- [ ] **T4.1** Consolidar compose stacks em `docker-compose.enterprise.yml` (comentado, seccionado, com healthchecks)
- [ ] **T4.2** Mover todas as configs para `/srv/ops/docker/` com symlinks para os diretórios originais
- [ ] **T4.3** Versionar `docker-compose.enterprise.yml` no monorepo (git)
- [ ] **T4.4** Criar `scripts/drift-check.sh` — compara estado real dos containers com compose declarado
- [ ] **T4.5** Expandir Terraform: adicionar WAF rules, rate limiting, e page rules ao módulo existente

### Fase 5: Security Hardening (Médio, ~4h)
```
Prazo: 2026-05-12
Impacto: Superfície de ataque reduzida
```

**Tarefas:**
- [ ] **T5.1** Configurar Cloudflare WAF rules:
  - Rate limiting: 100 req/min por IP em `/api/*`
  - Block: user-agent vazio, países não-BR (se aplicável)
  - Managed ruleset: OWASP Top 10 + Cloudflare Free Managed Rules
- [ ] **T5.2** Criar `scripts/vulnerability-scan.sh` — Trivy scan em todas as imagens Docker, semanal
- [ ] **T5.3** Configurar audit logging centralizado: syslog-ng → `/srv/ops/logs/audit/`
- [ ] **T5.4** Hardening systemd: `ProtectSystem=strict`, `NoNewPrivileges=yes` para serviços não-Coolify

### Fase 6: DR + Resilience (Longo, ~8h)
```
Prazo: 2026-05-17
Impacto: Capacidade de recuperar de qualquer falha
```

**Tarefas:**
- [ ] **T6.1** Criar `docs/RUNBOOKS/disaster-recovery.md` — guia completo de restore from scratch
- [ ] **T6.2** Criar `scripts/dr-simulate.sh` — simula falha total (containers + dados) e testa restore
- [ ] **T6.3** Implementar blue/green deploy no Coolify (mesmo single-node: portas alternadas)
- [ ] **T6.4** Criar `scripts/auto-rollback.sh` — detecta falha pós-deploy e reverte
- [ ] **T6.5** Testar DR completo: desligar todos containers, restaurar de ZFS snapshot, verificar todos serviços

---

## 4. Service Dependency Map

```
                    ┌──────────────┐
                    │ Cloudflare   │
                    │ Tunnel       │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌──────────┐
        │ Coolify │  │ Gitea   │  │ Keycloak │
        │ :8000   │  │ :3300   │  │ :8080    │
        └────┬────┘  └────┬────┘  └────┬─────┘
             │            │            │
    ┌────────┼────────────┼────────────┼──────────┐
    ▼        ▼            ▼            ▼           ▼
┌───────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
│Redis  │ │LiteLLM   │ │Qdrant  │ │Ollama   │ │Hermes    │
│:6379  │ │:4000     │ │:6333   │ │:11434   │ │:8642     │
└───┬───┘ └────┬─────┘ └───┬────┘ └────┬────┘ └────┬─────┘
    │          │            │          │            │
    ▼          ▼            ▼          ▼            ▼
┌────────────────────────────────────────────────────────┐
│       PostgreSQL (coolify-db / litellm-db)             │
│       ZFS tank/docker-data                             │
│       ZFS tank/monorepo                                │
└────────────────────────────────────────────────────────┘
```

**Critical path:** Cloudflare → Coolify → PostgreSQL → (all apps)
**Single point of failure:** NVMe físico. Mitigado por ZFS checksums + scrub + backups.
**Recovery time objective (RTO):** 30 minutos (redeploy containers de backup)
**Recovery point objective (RPO):** 6 horas (snapshots ZFS a cada 6h)

---

## 5. Hermes as Automated Caretaker

### Novos comandos Telegram que o Hermes deve ter:

| Comando | Função |
|---------|--------|
| `/versions` | Reporta VERSIONS.md + audit de `:latest` |
| `/slo` | Reporta SLO compliance atual (últimos 30d) |
| `/backup-status` | Status de todos os backups + última verificação |
| `/drift` | Drift check — containers vs compose declarado |
| `/incident [service]` | Inicia runbook de incidente para o serviço |
| `/vuln` | Último scan de vulnerabilidades |

### Cron jobs adicionais (Hermes gerencia):

| Job | Schedule | Ação |
|-----|----------|------|
| `docker-digest-audit` | Diário 07:00 | Detecta `:latest`, reporta Telegram |
| `backup-verify` | Dom 10:00 | Restore + verify, reporta Telegram |
| `drift-check` | Diário 08:00 | Compara estado real com declarado |
| `vulnerability-scan` | Dom 03:00 | Trivy scan, reporta Telegram |
| `synthetic-prober` | `*/5 * * * *` | Probe HTTP em 13 subdomínios |

---

## 6. Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | Zero docker images com tag `:latest` no ambiente | `docker-digest-audit.sh` retorna 0 |
| SC-2 | Todos os backups verificados (restore test passou) | `backup-verify.sh` retorna 0 |
| SC-3 | Alertmanager envia alertas para Telegram | Disparar alerta de teste e receber no Telegram |
| SC-4 | Todos os 13 subdomínios respondem no synthetic prober | `synthetic-prober.sh` retorna 13/13 |
| SC-5 | Drift check reporta 0 diferenças | `drift-check.sh` retorna "CLEAN" |
| SC-6 | DR simulation completa em < 30 min | `dr-simulate.sh` cronometrado |
| SC-7 | Versions manifest contém todas as 21 imagens | `wc -l VERSIONS.md` >= 21 entries |

---

## 7. Non-Goals

- **NÃO** adicionar segundo node físico (sem orçamento)
- **NÃO** migrar para Kubernetes (overkill para single node)
- **NÃO** implementar CI/CD para infra (Coolify já resolve)
- **NÃO** substituir ZFS por outro filesystem
- **NÃO** expor portas diretamente (manter Cloudflare Tunnel)
- **NÃO** adicionar complexidade desnecessária — cada tool adicionada deve ter justificativa clara

---

## 8. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-03 | Pin docker images by digest, not tag | `:latest` tags são não-deterministicas. Digest SHA256 garante immutabilidade. |
| 2026-05-03 | Hermes como único receiver de alertas | Telegram é o canal de comunicação existente. Evitar adicionar email/Slack/PagerDuty. |
| 2026-05-03 | 6h RPO aceitável para single-node | ZFS snapshots a cada 6h é o granularidade atual. Diminuir para 1h custaria mais IO. |
| 2026-05-03 | Consolidar compose stacks em 1 arquivo | Fragmentação atual dificulta manutenção e drift detection. Um arquivo = um source of truth. |

---

## 9. Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ-1 | Offsite backup: B2 Backblaze (~$6/mês) ou bucket S3 próprio? | Budget — necessário para 3-2-1 |
| OQ-2 | Coolify suporta blue/green deploy em single node (port swap)? | T6.3 — verificar na doc do Coolify |
| OQ-3 | WAF managed rules do plano Free do Cloudflare são suficientes? | T5.1 — ou precisa de Pro ($20/mês)? |
