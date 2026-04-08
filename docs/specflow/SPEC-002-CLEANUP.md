# SPEC-002-CLEANUP: Homelab Cleanup Pós-Refatoração

**Versão:** 1.0
**Data:** 2026-04-08
**Status:** Draft
**Dependência:** SPEC-002 (Homelab Infrastructure Refactoring)

---

## Contexto

Após implementar a refatoração (SPEC-002), os seguintes artifacts órfãos precisam ser limpos:

- Containers Docker parados/exited
- Old cloudflared configs e credenciais
- Terraform state drift (recursos deprecated)
- Old Cloudflare DNS records (aurelia, chat)
- Cloudflare Zero Trust Access apps (aurelia, chat)
- Logs legados (Docker, systemd, Coolify)
- Cron jobs de serviços removidos
- Filesystem dirs/arquivos órfãos
- Certificados SSL velhos
- Dashboards Grafana órfãos

---

## 1. Docker Ghosts

### Identificar

```bash
# Todos containers (incluindo parados)
docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.RunningFor}}"

# Containers parados
docker ps -a --filter "status=exited"

# Volumes não utilizados
docker volume ls -f dangling=true

# Networks não utilizadas
docker network ls -f dangling=true
```

### Containers Sabidamente Removidos (não devem existir)

| Container | Status esperado |
|-----------|----------------|
| `tts-bridge` | REMOVIDO (OOm, duplicava Kokoro) |
| `nginx-ratelimit` | REMOVIDO |
| `supabase-*` (13 containers) | REMOVIDOS |
| `captain-*` (CapRover) | REMOVIDOS |
| `voice-*` (voice-proxy, speaches, chatterbox-tts) | REMOVIDOS |

### Limpar

```bash
# Remover containers específicos
docker rm tts-bridge nginx-ratelimit 2>/dev/null

# Remover todos containers parados
docker container prune -f

# Remover volumes órfãos
docker volume prune -f

# Remover networks órfãs
docker network prune -f
```

---

## 2. Cloudflared Legacy

### Identificar

```bash
ls -la ~/.cloudflared/
cloudflared tunnel list
cd /srv/ops/terraform/cloudflare && terraform state list | grep -v "data\|random"
```

### Old Config Files (home do cloudflared)

| Arquivo | Ação |
|---------|------|
| `~/.cloudflared/config.yml` | Manter (documentação local, não crítico) |
| `~/.cloudflared/*.json` (tunnels antigos) | Verificar se tunnel ID ainda existe no Terraform |
| `/srv/ops/terraform/cloudflare/cloudflared.service` | Manter (gerado pelo Terraform) |

### Old Ingress Rules (deprecated subdomains)

- `aurelia.zappro.site` — REMOVIDO do Terraform mas pode existir no state
- `chat.zappro.site` — NUNCA existiu no cloudflared local (só via Terraform)

### Limpar Terraform

```bash
cd /srv/ops/terraform/cloudflare
# Verificar drift
terraform plan
# Remover entries velhas se existirem
terraform state list | grep -E "aurelia|chat" && echo "HA ORPHANS"
```

---

## 3. Terraform State Drift

### Identificar

```bash
cd /srv/ops/terraform/cloudflare
terraform plan
terraform state list
```

### Recursos Sabidamente Removidos do Código

| Resource | Tipo | Motivo |
|---------|------|--------|
| `aurelia` service | var.services | Deprecated 2026-04-05 |
| old `chat` entry | var.services | Nunca deployado |
| old `supabase-*` resources | state | Removidos há semanas |

### State serial

- **Atual:** 137
- **Esperado:** 138 (após próxima aplicação com cleanup)

---

## 4. Cloudflare DNS

### Identificar (Dashboard Cloudflare)

Procurar CNAMEs com:
- `aurelia` no nome
- `chat` (apenas Cloudflare — nunca existed)
- Old tunnel CNAME targets (UUIDs velhos)

### Remover Manualmente

1. Cloudflare Dashboard → DNS → Records
2. Delete: `aurelia.zappro.site` CNAME
3. Delete: qualquer record `chat.zappro.site` (se existir — não deveria)

### Verificar via Terraform

```bash
cd /srv/ops/terraform/cloudflare
# Se terraform plan mostrar delete de DNS records — CONFIRMA
terraform plan | grep -E "aurelia|chat"
```

---

## 5. Cloudflare Zero Trust Access

### Identificar

Procurar no Cloudflare Zero Trust Dashboard → Access → Applications:

| Application | Status |
|------------|--------|
| `Homelab — aurelia` | DEPRECATED — deletar |
| `Homelab — chat` | DEPRECATED — deletar |

### Remover

Via Terraform (se ainda existirem no state):
```bash
cd /srv/ops/terraform/cloudflare
# terraform apply remove automaticamente se não estiver em var.services
terraform plan
```

Via Dashboard manualmente:
1. Zero Trust → Access → Applications
2. Delete "Homelab — aurelia"
3. Delete "Homelab — chat"

---

## 6. Logs Legados

### Identificar

```bash
# Docker logs
du -sh /var/lib/docker/containers/*/
ls -lh /var/lib/docker/containers/*/*.log

# Systemd journal (serviços removidos)
journalctl --no-pager | grep -iE "(supabase|caprover|voice|speaches|chatterbox|aurelia)"
journalctl --since "30 days ago" --no-pager | tail -20

# Coolify logs velhos
ls -la /srv/data/coolify/logs/ 2>/dev/null
du -sh /srv/data/coolify/logs/* 2>/dev/null

# Ops logs
ls -la /srv/ops/ai-governance/logs/
find /srv/ops/ai-governance/logs/ -type f -mtime +30
```

### Limpar

```bash
# Truncar Docker logs (libera espaço, mantém arquivos)
truncate -s 0 /var/lib/docker/containers/*/*.log

# Rotacionar journal (manter 30 dias)
journalctl --vacuum-time=30d

# Coolify logs velhos
find /srv/data/coolify/logs/ -type f -mtime +14 -delete 2>/dev/null

# Ops logs velhos
find /srv/ops/ai-governance/logs/ -type f -mtime +30 -delete
```

---

## 7. Cron Jobs Órfãos

### Identificar

```bash
crontab -l
ls -la /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/
systemctl list-timers --all
```

### Old Cron Jobs

| Job | Serviço | Status |
|-----|---------|--------|
| `backup-supabase.sh` | Supabase | REMOVIDO |
| `backup-caprover.sh` | CapRover | REMOVIDO |
| Old `snapshot-zfs` entries | ZFS | ATIVO (manter) |

### Limpar

```bash
# Remover scripts de backup de serviços removidos
rm /etc/cron.daily/backup-supabase.sh 2>/dev/null
rm /etc/cron.daily/backup-caprover.sh 2>/dev/null

# Cron jobs de serviços removidos (se existirem em crontab)
crontab -l | grep -vE "(supabase|caprover|voice)" | crontab - || true
```

---

## 8. Filesystem Órfãos

### Identificar

```bash
# Diretórios de serviços removidos
ls -la /srv/apps/
ls -la /srv/backups/

# .env files
find /srv /home -name ".env" -type f 2>/dev/null

# docker-compose files de serviços removidos
find /srv /home -name "docker-compose*.yml" -type f 2>/dev/null

# ZFS datasets para serviços removidos
sudo zfs list -t filesystem -r tank | grep -iE "(supabase|caprover|voice)"
```

### Órfãos Conhecidos

| Path | Serviço | Ação |
|------|---------|------|
| `/srv/apps/supabase/` | Supabase | Verificar se vazio, archivar |
| `/srv/apps/caprover/` | CapRover | Verificar se vazio, archivar |
| `/srv/backups/supabase/` | Supabase | Archivar (não deletar) |
| `/srv/backups/caprover/` | CapRover | Archivar (não deletar) |
| `/srv/data/supabase/` | Supabase | Manter (dados) |
| `~/caprover-data/` | CapRover | Verificar se vazio |

### Limpar (CUIDADO — não deletar dados!)

```bash
# ZFS snapshot antes
sudo zfs snapshot -r tank@pre-cleanup-$(date +%Y%m%d)

# Archivar diretórios órfãos (não deletar — pode conter dados)
mkdir -p /srv/backups/archive/$(date +%Y%m%d)
mv /srv/apps/supabase/ /srv/backups/archive/$(date +%Y%m%d)/ 2>/dev/null
mv /srv/apps/caprover/ /srv/backups/archive/$(date +%Y%m%d)/ 2>/dev/null
```

---

## 9. Coolify Órfãos

### Identificar

```bash
# Aplicações no Coolify
curl -s http://localhost:8000/api 2>/dev/null | python3 -c "import sys,json; print([a.get('name') for a in json.load(sys.stdin).get('result',[])])" 2>/dev/null || echo "Check UI"

# Volumes Coolify
docker volume ls | grep -i coolify | head -20

# Certificados SSL velhos
find /srv/data/coolify -name "*.pem" -o -name "*.key" -o -name "*.crt" 2>/dev/null
```

### Órfãos Coolify

| Resource | Ação |
|---------|------|
| Old Supabase deployment metadata | Arquivar via Coolify UI |
| Old SSL certs (aurelia, chat) | Deletar via Coolify UI |
| Volumes órfãos | `docker volume prune -f` |

---

## 10. Monitoring Órfãos

### Identificar

```bash
# Dashboards Grafana
docker exec grafana grafana-cli admin list dashboards 2>/dev/null | grep -iE "(supabase|caprover|voice)"

# Prometheus rules
docker exec prometheus ls /etc/prometheus/rules/ 2>/dev/null

# Prometheus targets órfãos
docker exec prometheus curl -s localhost:9090/api/v1/targets 2>/dev/null | python3 -c "import sys,json; targets=json.load(sys.stdin).get('data',{}).get('targets',[]); print([t.get('labels',{}).get('job') for t in targets if any(x in str(t) for x in ['supabase','caprover','voice'])])"
```

### Dashboards Sabidamente Removidos

| Dashboard | Serviço |
|-----------|---------|
| Supabase metrics | Removido |
| CapRover metrics | Removido |
| Voice pipeline | Removido |

### Limpar

```bash
# Grafana dashboards
docker exec grafana grafana-cli admin delete-dashboard "Supabase" 2>/dev/null
docker exec grafana grafana-cli admin delete-dashboard "CapRover" 2>/dev/null
docker exec grafana grafana-cli admin delete-dashboard "Voice Pipeline" 2>/dev/null

# Prometheus rules
docker exec prometheus rm -f /etc/prometheus/rules/supabase.yml 2>/dev/null
docker exec prometheus rm -f /etc/prometheus/rules/caprover.yml 2>/dev/null
docker exec prometheus rm -f /etc/prometheus/rules/voice.yml 2>/dev/null
docker exec prometheus kill -HUP 1
```

---

## Checklist de Execução

### Phase 1: Snapshot (OBRIGATÓRIO)
- [ ] `sudo zfs snapshot -r tank@pre-cleanup-$(date +%Y%m%d)`
- [ ] Backup Coolify DB: `docker exec coolify-db pg_dump -U postgres coolify > /srv/backups/coolify-db-$(date +%Y%m%d).sql`
- [ ] Commit atual: `git -C /srv/ops checkpoint`

### Phase 2: Identificar
- [ ] `docker ps -a` — listar todos containers
- [ ] `terraform plan` — listar drift
- [ ] `journalctl --since "7 days ago"` — verificar logs velhos
- [ ] Cloudflare Dashboard — listar DNS e Access apps

### Phase 3: Limpar (em ordem)
- [ ] 1. Docker ghosts (containers, volumes, networks)
- [ ] 2. Filesystem órfãos (arquivar, não deletar)
- [ ] 3. Logs (truncar Docker, rotacionar journal)
- [ ] 4. Cron jobs velhos
- [ ] 5. Coolify órfãos (certificados, deployments)
- [ ] 6. Monitoring (dashboards, rules)
- [ ] 7. Terraform state drift
- [ ] 8. Cloudflare DNS records velhos
- [ ] 9. Cloudflare Zero Trust apps velhas
- [ ] 10. cloudflared legacy configs

### Phase 4: Verificar
- [ ] `docker ps -a` — só containers ativos
- [ ] `terraform plan` — 0 mudanças
- [ ] `cloudflared tunnel list` — só tunnel atual
- [ ] `curl https://chat.zappro.site` — 302 ou 200 (não 502/521)
- [ ] Smoke tests: `bash /srv/monorepo/smoke-tests/smoke-chat-zappro-site.sh`

---

## Comandos Resumo (copy-paste)

```bash
# 1. Snapshot
sudo zfs snapshot -r tank@pre-cleanup-$(date +%Y%m%d)

# 2. Docker cleanup
docker container prune -f
docker volume prune -f
docker network prune -f

# 3. Truncar Docker logs
truncate -s 0 /var/lib/docker/containers/*/*.log

# 4. Journal vacuum
journalctl --vacuum-time=30d

# 5. Coolify old logs
find /srv/data/coolify/logs/ -type f -mtime +14 -delete

# 6. Ops logs old
find /srv/ops/ai-governance/logs/ -type f -mtime +30 -delete

# 7. Cron cleanup
rm /etc/cron.daily/backup-supabase.sh 2>/dev/null
rm /etc/cron.daily/backup-caprover.sh 2>/dev/null

# 8. Terraform drift check
cd /srv/ops/terraform/cloudflare && terraform plan

# 9. Cloudflare tunnel list
cloudflared tunnel list

# 10. Smoke test
bash /srv/monorepo/smoke-tests/smoke-chat-zappro-site.sh
```
