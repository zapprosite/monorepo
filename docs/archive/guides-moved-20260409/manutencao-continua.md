# Manutenção Contínua — will-zappro
> Ubuntu 24.04.4 | Coolify 4.0.0-beta.470
> Versão: 1.1 | 2026-04-04

---

## Filosofia: Segurança como Processo, Não Evento

Hardening é só o início. Este guia garante que o sistema **permaneça seguro** com o tempo.

---

## 1. Atualizações Automáticas — Piloto Automático

### O que foi configurado
```
Unattended-Upgrade: ATIVO ✅
- Atualizações diárias (1x por dia)
- Limpeza automática (7 em 7 dias)
- Sem reboot automático (reboot manual quando precisar)
- Patches de segurança aplicados automaticamente
```

### Verificar se está funcionando
```bash
# Logs de updates
tail -20 /var/log/unattended-upgrades/unattended-upgrades.log

# Próximo update
systemctl status unattended-upgrades
```

### Quando chegou update crítico
```bash
# Ver se há updates pendentes
apt list --upgradable 2>/dev/null

# Se vier reboot necessário (kernel, glibc):
# WARNING: o sistema vai notificar, não ignore
sudo reboot
```

### NÃO fazer (nunca)
```bash
# ❌ NUNCA rode apt upgrade manualmente no host
# Isso pode quebrar drivers NVIDIA, ZFS, Coolify
sudo apt upgrade   # PROIBIDO
sudo apt dist-upgrade  # PROIBIDO
sudo do-release-upgrade  # PROIBIDO
```

---

## 2. Coolify — Manter Pinado

### Versão atual: `4.0.0-beta.470`
```
Docker image: ghcr.io/coollabsio/coolify:4.0.0-beta.470
```

### Antes de qualquer update do Coolify
```bash
# 1. Snapshot ZFS (OBRIGATÓRIO)
SNAPSHOT_NAME="tank@pre-coolify-$(date +%Y%m%d-%H%M%S)-update"
sudo zfs snapshot -r "$SNAPSHOT_NAME"
echo "Snapshot: $SNAPSHOT_NAME"

# 2. Verificar se atualização é compatível
#    Leia changelog em coolify.io/changelog

# 3. Atualizar (usar imagem PINADA, não latest)
cd /srv/data/coolify/source
docker compose pull ghcr.io/coollabsio/coolify:4.0.0-beta.470
docker compose up -d

# 4. Testar login e deploys antes de sair
curl -s http://localhost:8000/api/v1/health

# 5. Se quebrou: rollback
#    Identifica snapshot mais recente
# SNAPSHOT=$(sudo zfs list -t snapshot -o name | grep "tank@pre-coolify-" | sort -r | head -1)
# sudo zfs rollback -r "$SNAPSHOT"
```

### Cron horário (lock automático)
```bash
# Verificado a cada hora
cat /etc/cron.d/coolify-lock

# Executar manualmente
/srv/ops/scripts/coolify-lock.sh
```

---

## 3. Kernel — NÃO ATUALIZAR

### Atual: `6.17.0-20-generic`
```
Motivo: funciona com ZFS + NVIDIA + todos os drivers
Risk: update pode quebrar boot, ZFS pool, ou GPU passthrough
```

### O que fazer se precisar de security patch de kernel
```bash
# 1. snapshot ZFS PRIMEIRO
sudo zfs snapshot -r "tank@pre-kernel-update-$(date +%Y%m%d)"

# 2. Avaliar risco com time (você ou time de infra)

# 3. Se for security crítico (CVSS 9+):
#    atualizar. Se não: esperar release stable seguinte.
```

---

## 4. Docker / Containers — Atualizar Imagens com Cuidado

### Regra: Coolify atualiza os containers dele
```bash
# Coolify apps: atualizar via Coolify UI, não manualmente
# NÃO fazer docker pull isolado de imagens do Coolify
docker pull ghcr.io/coollabsio/coolify:4.0.0-beta.470  # ❌ não fazer manualmente
```

### Para stacks fora do Coolify (se houver)
```bash
# Verificar versions pinadas
cat /srv/data/aurelia/.env | grep VERSION
cat /home/will/zappro-lite/config.yaml

# Atualizar via compose file, não latest
docker compose pull && docker compose up -d
```

---

## 5. NVIDIA — NÃO TOCAR

### Driver atual: RTX 4090 (proprietário)
```bash
# Verificar
nvidia-smi | grep "Driver Version"

# ⚠️ Atualizar driver NVIDIA pode quebrar Ollama, Kokoro, Coolify GPU features
# Só atualizar se GPU Para de funcionar completamente
```

---

## 6. ZFS — Snapshots Regulares

### Policy atual
```bash
# Antes de qualquer mudança estrutural (sempre)
sudo zfs snapshot -r "tank@pre-NOME-DATA"
# Exemplo:
sudo zfs snapshot -r "tank@pre-coolify-update-20260404"

# Listar snapshots
zfs list -t snapshot | grep tank | sort -k1

# Rollback (se algo quebrou)
sudo zfs rollback -r tank@pre-coolify-update-20260404
```

### Limpeza de snapshots velhos
```bash
# Listar snapshots antigos (>30 dias)
# Formato: tank@pre-20260404-143000-nome
zfs list -t snapshot -r tank -o name,creation | awk 'NR==1 || $2 < "2026-03-05"'

# ⚠️ NÃO destruir sem aprovação humana
# snapshots são a única forma de recovery rápido
# Limite prático: manter últimos 50 snapshots, destruir o excesso mais antigo
```

---

## 7. Cloudflare — Não mexer

### Config atual
```bash
# Token: já existente (não recriar
# DNS records: via Terraform em /srv/ops/terraform/
# Tunnel: cloudflared rodando como daemon
```

### Se precisar mudar DNS
```bash
cd /srv/ops/terraform/cloudflare
# editar terraform/terraform.tfvars
terraform plan
# ⚠️ terraform apply só com APPROVAÇÃO
```

---

## 8. Monitoring — O Que Assistir

### Semanalmente
```bash
# 1. Falhas de login SSH
faillock --user will --failed
faillock --user root --failed
journalctl -u ssh --since "7 days ago" | grep -i "failed" | wc -l

# 2. Coolify SSH connection (CHAVE)
# Verificar se chave do Coolify está em authorized_keys
grep -q "phpseclib-generated-key" /home/will/.ssh/authorized_keys && echo "✅ Coolify SSH key OK" || echo "❌ Coolify SSH key FALTANDO"

# Verificar UFW docker0 rule (porta 2222 proxy)
sudo ufw status | grep -qE "2222 on docker0|2222 .v6. on docker0" && echo "✅ UFW docker0→2222 OK" || echo "❌ UFW docker0→2222 FALTANDO"

# Verificar UFW Docker→port22 (CRÍTICO para Sentinel)
sudo ufw status | grep -qE "22.*10.0.0.0|10.0.0.0.*22" && echo "✅ UFW Docker→22 OK" || echo "❌ UFW Docker→22 FALTANDO"

# Verificar status Sentinel (is_reachable, is_usable)
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT s.name, ss.is_reachable, ss.is_usable FROM servers s JOIN server_settings ss ON s.id = ss.server_id WHERE s.name='localhost';" 2>&1 | grep -E "t|f"

# 3. Services down
systemctl list-units --type=service --state=failed --no-legend
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v Up

# 4. ZFS pool health
STATE=$(zpool status tank 2>/dev/null | grep "state:" | awk '{print $2}')
if [ "$STATE" = "ONLINE" ]; then echo "OK: ZFS pool ONLINE"; else echo "ERRO: ZFS pool em estado $STATE"; zpool status tank; fi

# 5. Espaço em disco
df -h /srv / /home

# 6. Updates de segurança pendentes
cat /var/log/unattended-upgrades/unattended-upgrades.log | grep -E "upgraded|removed|installed" | tail -20
```

### Comportamento Esperado
| Comportamento | Significado |
|---------------|-----------|
| UFW bloqueando tentativas de SSH em port 22 | Normal (port scanner) |
| fail2ban bloqueando IP após 3 tentativas | Normal (ataque repelido) |
| Docker containers restarting | Normal (health check) |
| Unattended upgrade log vazio | Normal (nada a atualizar) |

### Comportamento de Alerta
| Sintoma | Ação |
|---------|------|
| `zpool status` mostra DEGRADED | ⚠️ Chamar help |
| Docker containers TODOS parados | ⚠️ Restartar e investigar |
| Coolify retorna 500 constante | ⚠️ Ver logs + rollback ZFS |
| SSH login falhando mesmo com senha certa | ⚠️ Verificar UFW + fail2ban |
| Proxy Traefik/Gitea lento ou down | ⚠️ docker compose restart |
| Subdomain retorna 502 | ⚠️ Verificar cloudflared + porta do serviço |

---

## 8.5 Cloudflared Tunnel — Troubleshooting

### 502 Gateway Invalid (Cloudflare)
**Sintoma:** Subdomain (ex: `git.zappro.site`) retorna "502 Bad Gateway"

**Causa mais comum:** Porta errada no config.yml (`~/.cloudflared/config.yml`)

**Verificação:**
```bash
# Verificar logs do cloudflared
journalctl -u cloudflared --no-pager -n 20 | grep -E "2222|3300|SSH"

# Se ver "SSH-2.0-OpenSSH" significa que está tentando HTTP para porta SSH
```

**Solução:**
```bash
# 1. Verificar portas dos serviços
# Gitea web: 3300 (não 2222!)
# Coolify: 8000
# OpenClaw: 4001

# 2. Ver config.yml
cat ~/.cloudflared/config.yml | grep -A2 "git.zappro"

# Se git.zappro.site → service: http://localhost:2222
# MUDAR PARA: service: http://localhost:3300

# 3. Editar config
nano ~/.cloudflared/config.yml
# Alterar porta correta

# 4. Restart cloudflared
sudo systemctl restart cloudflared

# 5. Testar
curl -sI https://git.zappro.site
# Esperado: HTTP/2 302 (redirect para login)
```

**Ports mapping de referência:**
| Serviço | Porta Host | URL Cloudflare |
|---------|-----------|---------------|
| Gitea Web | 3300 | git.zappro.site |
| Gitea SSH | 2222 | (não exposto via tunnel) |
| Coolify | 8000 | coolify.zappro.site |
| OpenClaw | 4001 | bot.zappro.site |

**Nota:** O config local (`~/.cloudflared/config.yml`) é o que importa para cloudflared.
O Terraform gerencia apenas o DNS e Cloudflare Access, não o tunnel ingress.

---

## 9. Rotina Semanal Sugerida (15 min/semana)

```bash
# ═══════════════════════════════════════════════════
# SEGUNDA-FEIRA — Health Check Rápido (5 min)
# ═══════════════════════════════════════════════════

# 1. Tudo rodando?
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v Up | head -5
# Se tudo Up: ✅

# 2. ZFS OK?
STATE=$(zpool status tank 2>/dev/null | grep "state:" | awk '{print $2}')
if [ "$STATE" = "ONLINE" ]; then echo "OK: ZFS ONLINE"; else echo "ERRO: ZFS $STATE"; fi

# 3. Unattended upgrades rodaram?
tail -5 /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null

# 4. UFW bloqueando algo suspeito?
sudo ufw status | grep DENY | tail -10

# ═══════════════════════════════════════════════════
# APLICAR SÓ SE NECESSÁRIO
# ═══════════════════════════════════════════════════

# 5. Snapshot antes de qualquer mudança
sudo zfs snapshot -r "tank@pre-change-$(date +%Y%m%d)-manual"

# 6. Coolify respondendo?
curl -sf http://localhost:8000/api/v1/health && echo " OK" || echo " FALHOU"

# 7. GPU livre?
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader

# ═══════════════════════════════════════════════════
# MENSAIS (fim do mês)
# ═══════════════════════════════════════════════════

# 8. Cleanup Docker (espaço)
docker system df
docker system prune -f

# 9. Ver snapshots ZFS pendentes de cleanup
zfs list -t snapshot | grep tank | wc -l
# Se muitos snapshots (limite de pool de snapshots do seu ZFS)

# 10. Ver logs de auditoria
ausearch -k user_mod --i | tail -10
```

---

## 10. O Que NUNCA Fazer (Recap)

| ❌ Proibido | Por quê |
|-------------|--------|
| `apt upgrade` no host | Pode quebrar NVIDIA, ZFS, drivers |
| `apt dist-upgrade` | Atualiza kernel e todos os pacotes |
| `do-release-upgrade` | Atualiza Ubuntu inteiro |
| `zpool upgrade` | Pode quebrar compatibilidade |
| `zfs destroy` em produção | Perde dados permanentemente |
| `terraform destroy` | Remove infraestrutura Cloudflare |
| `curl coolify.io/install.sh` | Script de terceiros no host |
| `docker pull :latest` | Atualização descontrolada |
| Mudar senha root/admin sem guardar | Lock out |
| Desabilitar fail2ban | Ataques de brute force desprotegidos |
| Mudar UFW sem backup | Regra removida = exposição |

---

## 11. Backup dos Arquivos de Configuração

```bash
# Os arquivos críticos que devem ser versionados no Gitea:
# /srv/ops/terraform/cloudflare/     # DNS records
# /srv/ops/scripts/coolify-lock.sh  # Lock script
# ~/.claude/settings.json            # Config do Claude Code

# Não versionar:
# /srv/data/coolify/.env           # Secrets
# ~/.ssh/                          # Chaves
# /data/coolify/ssh/              # SSH keys
```

---

## 12. Secrets — Infisical Vault

### Configuração
| Item | Valor |
|------|-------|
| Local API | http://127.0.0.1:8200 |
| Projeto | zappro-p-tc-k |
| Environment | dev |
| Service Token | `st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad` |

### Health Check
```bash
# 1. API respondendo?
curl -s http://127.0.0.1:8200/api/status | python3 -m json.tool

# 2. Token válido?
python3 -c "
from infisical_sdk import InfisicalSDKClient
c = InfisicalSDKClient(host='http://127.0.0.1:8200', token='st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad')
s = c.secrets.list_secrets(project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', environment_slug='dev', secret_path='/')
print(f'Secrets no vault: {len(s.secrets)}')
"
```

### Secrets Críticas (Sincronizar com manuais)
**⚠️ NÃO COMMITAR** — estas estão no Infisical:
- `APP_KEY` → Coolify root
- `POSTGRES_PASSWORD` → coolify-db-password-2026
- `REDIS_PASSWORD` → coolify-redis-password-2026
- `ROOT_USER_PASSWORD` → [COOLIFY_ROOT_PASSWORD]
- `AUTH_SECRET` / `JWT_AUTH_SECRET` → OpenClaw auth
- `HERMES_AGENT_GATEWAY_TOKEN` → OpenClaw gateway
- `GF_SECURITY_ADMIN_PASSWORD` → Grafana admin

### Atualização de Secrets
```bash
# NÃO editar secrets diretamente nos containers
# Usar Infisical SDK ou dashboard

# Via SDK Python:
python3 << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.799590ae-..."
)
client.secrets.update_secret_by_name(
    current_secret_name="NOME_SECRET",
    project_id="e42657ef-...",
    environment_slug="dev",
    secret_path="/",
    secret_value="novo_valor"
)
EOF
```

### Cruzamento de Secrets — Tabela de Referência

| Secret | Infisical Path | Valor Real | Onde Usado |
|--------|---------------|------------|------------|
| `APP_KEY` | coolify/app_key | `base64:jRrMu3906d/...` | Coolify |
| `DB_PASSWORD` | coolify/db_password | `coolify-db-password-2026` | coolify-db |
| `REDIS_PASSWORD` | coolify/redis_password | `coolify-redis-password-2026` | coolify-redis |
| `ROOT_USER_PASSWORD` | coolify/root_password | `[COOLIFY_ROOT_PASSWORD]` | Coolify admin |
| `SENTINEL_TOKEN` | coolify/sentinel_token | JWT em server_settings | Sentinel auth |

### Referência Completa
Ver `manter_infisical.md` para procedimentos detalhados.

---

## 13.Referências Rápidas

| Guia | Quando usar |
|------|------------|
| `guide-security-hardening.md` | Auditoria e hardening inicial |
| `guide-cli-gitea-coolify.md` | GitOps e deployment |
| `manter_infisical.md` | Secrets e vault |
| `CLAUDE-CODE-REFERENCE.md` | CLI e ferramentas |
| `/srv/ops/ai-governance/` | Governança completa |

---

*Manutenção Contínua — will-zappro | Atualize quando mudar a stack*

---

## 13. CLI Aliases de Manutenção (copie para ~/.bashrc)

```bash
# Manutenção
alias zdanger="sudo zfs snapshot -r tank@pre-\$(date +%Y%m%d)"
alias zhealth="zpool status tank | grep -E 'state:|DEGRADED|FAULTED' | grep -v 'ONLINE'"
alias dhealth="docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -v Up"
alias ussh="sudo ufw status verbose | grep -E 'DENY|To.*ALLOW'"
alias ssh-fails="faillock --user will --failed"
alias coolify-health="curl -s http://localhost:8000/api/v1/health | python3 -m json.tool 2>/dev/null || echo 'Falhou'"
alias gpu-check="nvidia-smi --query-gpu=memory.used,memory.free,utilization.gpu --format=csv,noheader"

# Coolify SSH — VERIFICAÇÃO CRÍTICA (executar se Coolify não conecta ao host)
alias coolify-ssh-check='grep -q "coolify-generated\|phpseclib-generated-key" /home/will/.ssh/authorized_keys && echo "✅ Coolify SSH key OK" || echo "❌ Coolify SSH key FALTANDO"; sudo ufw status | grep -qE "2222 on docker0|2222 .v6. on docker0" && echo "✅ UFW docker0→2222 OK" || echo "❌ UFW docker0→2222 FALTANDO"; sudo ufw status | grep -qE "22.*10.0.0.0|10.0.0.0.*22" && echo "✅ UFW Docker→22 OK" || echo "❌ UFW Docker→22 FALTANDO"'
```
