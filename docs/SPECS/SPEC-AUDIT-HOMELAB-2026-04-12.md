# Homelab Audit — 2026-04-12

**Auditor:** Claude Code CLI (15 agents parallel research)
**Data:** 2026-04-12
**Branch:** `feature/next-1775987520`

---

## O QUE TEMOS DE BOM

### 1. Arquitetura de Storage Sólida
- ZFS tank 3.62TB em NVMe Gen5 — 67.5GB usado (1.9%), 3.56TB livre
- Separação correta: Gen4 para boot/sistema, Gen5 para dados
- lz4 compression ativo (1.32x ratio)
- Snapshots ZFS a cada 6h com retenção hierárquica (7 daily / 4 weekly / 6 monthly)
- Deduplicação DESABILITADA — decisão correta (memória > benefício)

### 2. Voice Pipeline Engineering Brilhante
- **Deepgram proxy pattern** (SPEC-018): wav2vec2 parece Deepgram cloud — isolamento elegante
- **TTS Bridge voice filtering**: bloqueia 65/67 vozes Kokoro, só pm_santa e pf_dora
- STT: wav2vec2-large-xlsr-53-portuguese (PT-BR native, 5.8M downloads)
- TTS: Kokoro v0.2.2 com governance correta
- LLM enhancement layer: llama3-portuguese-tomcat-8b-instruct-q8

### 3. Governance de Audio Imutável
- SPEC-004, SPEC-005, SPEC-009 como PROTEGIDO
- Regras claras: NÃO usar Deepgram direto, NÃO usar LiteLLM como primario para MiniMax-M2.7
- Dual-layer protection: IMMUTABLE + PINNED

### 4. CI/CD Enterprise
- Gitea Actions + act_runner + GitHub mirror
- Conventional commits + branch validation
- Tag policy: vMAJOR.MINOR.PATCH (não date-based)
- SPEC-026 git mirror: scripts mirror-sync.sh, audit-branches.sh, cleanup-branches.sh
- Pre-push hook feature/xxx-yyy

### 5. Monitoring Stack
- Prometheus + Grafana + Loki + AlertManager (todos IMMUTABLE)
- docker-autoheal + self-healing-cron
- Grafana provisioning from YAML (datacenter dashboard)

### 6. GPU Setup Otimizado
- RTX 4090 24GB GDDR6X — top-tier para inference
- VRAM: 19.5GB usado, 5GB livre — cabeça saudável
- gemma2-9b-it:q4 (Q4_K_M — balance correto)
- llava:latest + nomic-embed-text carregados
- Temp 43C (water cooled), P2 state

### 7. Security Hardening
- MASTER_PASSWORD USB + SHA256 hash
- Infisical self-hosted (vault.zappro.site)
- Cloudflare Access + Zero Trust
- 8 serviços IMMUTABLE, 6 PINNED
- ZFS encryption em uso

---

## O QUE EU MELHORARIA (Prioritized)

### P0 — CRÍTICO (Fazer agora)

#### 1. TTS Bridge está DOWN
**Problema:** auto-healer detecta TTS Bridge DOWN. Exit 137 (OOM). OpenClaw está usando Kokoro direto :8880 com pm_alex — viola governance.
**Solução:**
```bash
# Restart TTS Bridge com memory limits
docker stop zappro-tts-bridge
docker rm zappro-tts-bridge
# Recriar com --memory=512m --memory-swap=512m
```
**Dependência:** SPEC-014 bloqueado até resolver

#### 2. ZFS ARC em conflito com containers
**Problema:** 7.8GB/8GB swap usado. ARC está tomando memória que containers precisam.
**Solução:**
```bash
# /etc/modprobe.d/zfs.conf
options zfs zfs_arc_max=8589934592    # 8GB max
options zfs zfs_arc_min=2147483648    # 2GB min
```
**Dependência:** Requer reboot ou remount

#### 3. voice-pipeline-loop.sh NÃO está no crontab
**Problema:** Script existe em `tasks/smoke-tests/` mas cron não está ativo.
**Solução:**
```bash
# Adicionar ao crontab
echo "*/5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh >> /srv/monorepo/logs/voice-pipeline/loop.log 2>&1" | crontab -
```

#### 4. SPEC Conflicts — Numeração Colidida
**Problema:** 
- SPEC-001 = template (DONE) E SPEC-001 = workflow-performatico (DRAFT)
- SPEC-002 = network-refactor (DRAFT) E SPEC-002 = homelab-monitor-agent (DRAFT)
- SPEC-014 = TTS route fix E SPEC-014 = CURSOR-AI-CICD-PATTERN
- SPEC-013 = 5 versões diferentes

**Solução:** Criar SPEC-AUDIT-RESOLUTION.md para renumerar e consolidar

---

### P1 — HIGH (Esta semana)

#### 5. Off-site backup MISSING
**Problema:** Todas backups locais — se nvme0n1 falhar, perde tudo.
**Solução:**
```bash
# Adquirir USB external drive
# Criar backup dataset
zpool create backuppool /dev/sdX
zfs create backuppool/zfs-send
# Monthly ZFS send
zfs send -R tank@backup-$(date +%Y%m%d) | zfs receive backuppool/zfs-send/tank
```

#### 6. nvidia-gpu-exporter :9835 exposto na LAN sem auth
**Problema:** Métricas GPU detalhadas acessíveis de toda a rede 192.168.0.0/16.
**Solução:**
```bash
# Restringir UFW
ufw allow from 10.0.19.0/24 to any port 9835
# Ou bindar só localhost
docker stop nvidia-gpu-exporter
# Recriar bindando a 127.0.0.1:9835
```

#### 7. SSH :2222 exposto "Anywhere"
**Problema:** Brute-force target.
**Solução:** Restringir a Tailscale-only ou usar jump-host pattern

#### 8. Gitea e Infisical DB sem backup no cron
**Problema:** Só Qdrant tem backup diário. Gitea e Infisical DB não têm.
**Solução:**
```bash
# Adicionar ao crontab
0 2 * * * docker exec gitea gitea dump --database --target /srv/backups/gitea-dump-$(date +\%Y\%m%d).zip
0 2 * * * docker exec infisical-db pg_dump -U infisical > /srv/backups/infisical-db-$(date +\%Y\%m%d).sql
```

#### 9. alert-deduplicator.md NÃO deployado
**Problema:** Skill existe mas não está ativo. Alert fatigue constante.
**Solução:** Deployar o skill documentado

#### 10. openclaw-qgtzrmi6771lt8l7x8rqx72f reiniciou após 26 min
**Problema:** Indica crash/OOM. Verificar logs.
**Solução:**
```bash
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 100
# Se OOM: adicionar memory limits
```

---

### P2 — MEDIUM (Este mês)

#### 11. PostgreSQL sem connection pooling
**Problema:** n8n e apps criam muitas conexões diretas.
**Solução:** Adicionar PgBouncer em transaction mode na frente do PostgreSQL

#### 12. Dragonfly > Redis para infisical-redis
**Problema:** Redis single-threaded. Dragonfly é 3-5x mais rápido, multi-threaded, 50% menos memória.
**Solução:** Benchmark com `dragondragon/dragonfly` como drop-in replacement

#### 13. chat.zappro.site sem Access policy
**Problema:** OpenWebUI exposto à internet sem Cloudflare Access — só http_host_header filtering.
**Solução:** Adicionar Access policy em `access.tf`

#### 14. Snapshot rotation não testado
**Problema:** Quarterly restore test procedure existe mas provavelmente não foi executado.
**Solução:** Executar restore test documentado

#### 15. Ollama embedding bisa upgrade
**Problema:** nomic-embed-text (atual) vs nomic-embed-text-v1.5 ou Qwen3-Embedding-0.6B.
**Solução:** Testar upgrade marginal

---

### P3 — LOW (Próximos meses)

#### 16. TensorRT-LLM para throughuput 2-5x
**Situação:** Ollama é simples mas vLLM é mais rápido. Não é urgente — Ollama está funcionando.

#### 17. Mamba 3B para testar SSM advantage
**Situação:** RWKV e Mamba são interessantes para streaming audio. Testar como alternativa marginal.

#### 18. Grafana Home dashboard
**Situação:** Não tem dashboard overview com traffic-light health. Criar.

#### 19. Version lock inacessível
**Problema:** `/srv/ops/ai-governance/VERSION-LOCK.md` não acessível do contexto monorepo.
**Solução:** Symlink para `/srv/monorepo/VERSION-LOCK.md`

---

## STACK QUE ESTÁ EXCELENTE (Não mexer)

| Componente | Veredicto |
|------------|-----------|
| ZFS + NVMe Gen5 | ✅ Correto — não migrar para btrfs |
| Ollama como inference engine | ✅ Correto — não trocar por vLLM agora |
| Qdrant como vector DB | ✅ Correto — Rust-based = predictable memory |
| Coolify como PaaS | ✅ Correto — GitOps, zero-downtime |
| LiteLLM como proxy | ✅ Correto — abstraction layer correta |
| Cloudflare Tunnel | ✅ Correto — Keep, não Tailscale-only |
| Docker autoheal | ✅ Funcionando há 42+ horas |
| Prometheus + Loki | ✅ Stack correto para homelab |
| Gitea Actions | ✅ Não migrar para Drone/Argo |

---

## COMPARATIVO: O QUE TEMOS vs April 2026 SOTA

| Área | Estado Atual | SOTA April 2026 | Veredicto |
|------|-------------|-----------------|-----------|
| **GPU** | RTX 4090 24GB | RTX 5090 32GB disponível | Still great — upgrade path clear |
| **Inference** | Ollama + GGUF Q4 | vLLM 2-5x faster | Adequate — upgrade when needed |
| **STT** | wav2vec2 PT-BR ✅ | No improvement needed | Best for PT-BR |
| **TTS** | Kokoro ✅ | No improvement needed | Best for PT-BR |
| **Storage** | ZFS + Gen5 ✅ | No change needed | State of art |
| **Containers** | Coolify + Docker ✅ | Podman not ready | Keep |
| **CI/CD** | Gitea Actions ✅ | ArgoCD overkill | Keep |
| **Monitoring** | Prometheus + Grafana ✅ | Thanos overkill for scale | Keep |

---

## AÇÃO IMEDIATA (Top 5)

1. **FIX TTS Bridge** — `docker restart zappro-tts-bridge` com memory limits
2. **ADD voice-pipeline-loop cron** — ativar script existente
3. **FIX ZFS ARC** — limitar a 8GB
4. **VERIFY chat.zappro.site Access** — adicionar policy
5. **ADD Gitea backup** — ao cron

---

## GASTOS ESTIMADOS

| Otimização | Custo | Prioridade |
|------------|-------|------------|
| USB external drive (4TB) | ~$50-80 | HIGH |
| YubiKey 5 (2x for backup) | ~$100-140 | MEDIUM |
|-time |
| New RTX 5090 32GB | ~$2200-2500 | LOW (only if VRAM constrained) |

**Custo elétrico atual:** ~$22-30/month (150 kWh)
**Potencial economia:** $5-10/month com GPU power limit 250W

---

## ROADMAP 6 MESES

| Mês | Foco |
|------|------|
| **Mês 1** | Fix TTS Bridge, ativar voice-loop cron, ZFS ARC tuning |
| **Mês 2** | Off-site backup (USB ZFS send), Gitea backup cron |
| **Mês 3** | Alert dedup deploy, Access policies |
| **Mês 4** | Test restore procedures, PostgreSQL pooling |
| **Mês 5** | Evaluate Dragonfly vs Redis, Mamba benchmarks |
| **Mês 6** | Consider RTX 5090 upgrade if needed |

---

**Conclusão:** O homelab está bem архитектурно para April 2026. As fraquezas principais são operacionais (TTS Bridge DOWN, cron missing, backup gap) não arquiteturais. Stack de voice pipeline é excellent — melhor que a maioria dos homelabs. Governança de audio está correta. Prioridade: estabilizar o que existe antes de adicionar features novas.
