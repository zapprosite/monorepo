# Security Hardening — will-zappro
> Ubuntu 24.04.4 LTS | Kernel 6.17.0-20-generic
> Auditoria: 2026-04-04 | **Atualizado: 2026-04-04** (regra UFW porta 22 Docker)

---

## ⚠️ Auditoria — Brechas Encontradas

### CRÍTICAS
| # | Brecha | Severidade |
|---|--------|------------|
| 1 | Unattended upgrades **DESABILITADO** — sistema não recebe patches | CRÍTICA |
| 2 | **Sem firewall** — UFW não instalado, portas expostas sem filtro | CRÍTICA |
| 3 | **Porta 0.0.0.0:8080** — Traefik dashboard (Coolify proxy) — API exposta | CRÍTICA |
| 3b | **Porta 0.0.0.0:3300** — Gitea MySQL exposta na LAN inteira | CRÍTICA |
| 3c | **Porta 0.0.0.0:631** — CUPS (mesmo service a ser removido) | CRÍTICA |

### ALTAS
| # | Brecha | Severidade |
|---|--------|------------|
| 4 | `avahi-daemon` rodando — vetor mDNS/DNS-rebinding | ALTA |
| 5 | `cups-browsed` rodando — PrintNightmare | ALTA |
| 6 | `rustdesk` + `gnome-remote-desktop` — acesso remoto | ALTA |
| 7 | `PASS_MAX_DAYS=99999` — senhas nunca expiram | ALTA |
| 8 | Sem complexidade de senha (`pwquality.conf` ausente) | ALTA |

### MÉDIAS
| # | Brecha | Severidade |
|---|--------|------------|
| 9 | JAVA runtime desnecessário (OpenJDK 21) | MÉDIA |
| 10 | Usuário `sync` com shell | MÉDIA |
| 11 | `apt` sources usando HTTP (MITM risk) | MÉDIA |
| 12 | `snapd` daemon rodando — attack surface | MÉDIA |

### BOAS PRÁTICAS JÁ PRESENTES ✅
- AppArmor ativo
- Seccomp habilitado
- SSH hardening (PermitRootLogin=no, PasswordAuth=no, AllowUsers=will)
- Fail2ban rodando
- Coolify pinado em 4.0.0-beta.470

---

## Script de Hardening

Rode como root:

```bash
sudo -i

# ═══════════════════════════════════════════════════════════════════
# 1. UNATTENDED UPGRADES — CRÍTICO
# ═══════════════════════════════════════════════════════════════════
apt install -y unattended-upgrades apt-listchanges
dpkg-reconfigure -plow unattended-upgrades

# Configurar auto-updates de segurança
cat > /etc/apt/apt.conf.d/99security << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Randomized-Sleep "3600";
Unattended-Upgrade::AutomaticReboot "false";
Unattended-Upgrade::AutomaticRebootWithUser "true";
Unattended-Upgrade::MinimalSteps "true";
EOF

# ═══════════════════════════════════════════════════════════════════
# 2. UFW — FIREWALL (CRÍTICO)
# ═══════════════════════════════════════════════════════════════════
apt install -y ufw
ufw --force reset

# Regras DEFAULT
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed

# SSH — porta 2222 (já hardening feito)
ufw allow 2222/tcp comment "SSH"

# Coolify — porta 8000 (HTTP only, Cloudflare Tunnel)
ufw allow from 10.0.0.0/8 to any port 8000 comment "Coolify internal"
ufw allow from 172.16.0.0/12 to any port 8000 comment "Coolify Docker"
ufw allow from 192.168.0.0/16 to any port 8000 comment "Coolify LAN"

# Cloudflare Tunnel (nuvem passa por CF, host só recebe de tunnel)
ufw deny 8000/tcp comment "Block direct Coolify - use tunnel"

# Traefik dashboard (port 8080) — APENAS localhost
ufw deny from any to any port 8080 comment "Traefik dashboard - block external"
# Se precisar acessar localmente via VNC:
# ufw allow from 127.0.0.1 to 127.0.0.1 port 8080

# Gitea MySQL (porta 3300) — APENAS Docker internal
ufw deny from any to any port 3300 comment "Gitea MySQL - block external"
ufw allow from 10.0.0.0/8 to any port 3300 comment "Gitea MySQL Docker internal"
ufw allow from 172.16.0.0/12 to any port 3300 comment "Gitea MySQL Docker bridge"

# CUPS (port 631) — REMOVER completamente (cups já disabled acima)
ufw deny 631/tcp comment "CUPS - already disabled"

# NVIDIA / GPU tools
ufw allow from 10.0.0.0/8 to any port 6333 comment "Qdrant internal"
ufw allow from 172.16.0.0/12 to any port 6333 comment "Qdrant Docker"
ufw allow from 192.168.0.0/16 to any port 6333 comment "Qdrant LAN"

# Ollama — só localhost
ufw deny from any to 127.0.0.1 port 11434 comment "Ollama localhost only"
ufw deny from any to any port 11434 comment "Ollama block external"

# LiteLLM — só localhost
ufw deny from any to 127.0.0.1 port 4000 comment "LiteLLM localhost"
ufw deny from any to any port 4000 comment "LiteLLM block external"

# Prometheus/Grafana — LAN only
ufw allow from 192.168.0.0/16 to any port 9090 comment "Prometheus LAN"
ufw allow from 192.168.0.0/16 to any port 3100 comment "Grafana LAN"

# Cloudflared (já protegido por Cloudflare Access)
# Não precisa expor portas extras

# Enable
ufw --force enable
ufw status verbose

# ═══════════════════════════════════════════════════════════════════
# 3. DESABILITAR SERVIÇOS DESNECESSÁRIOS (ATAQUE SURFACE)
# ═══════════════════════════════════════════════════════════════════

# avahi-daemon — mDNS/DNS-rebinding attack vector
systemctl stop avahi-daemon
systemctl disable avahi-daemon
systemctl mask avahi-daemon
echo "avahi-daemon desabilitado"

# cups-browsed — PrintNightmare / IPP
systemctl stop cups-browsed
systemctl disable cups-browsed
systemctl mask cups-browsed
echo "cups-browsed desabilitado"

# cups — só disable (pode precisar local)
systemctl stop cups
systemctl disable cups
systemctl mask cups
echo "cups desabilitado"

# ModemManager
systemctl stop ModemManager
systemctl disable ModemManager
systemctl mask ModemManager
echo "ModemManager desabilitado"

# snapd — só disable se não usar snaps críticos
# Verificar quais snaps são usados antes de desabilitar
# snap list
systemctl disable snapd.socket
systemctl stop snapd.socket
systemctl mask snapd.socket
echo "snapd.socket desabilitado"

# kerneloops — envia dados de crash externally
systemctl stop kerneloops
systemctl disable kerneloops
systemctl mask kerneloops
echo "kerneloops desabilitado"

# rustdesk + gnome-remote-desktop — já conectados à rede externa?
# WARNING: pode precisar para screen sharing local
# systemctl stop rustdesk.service (verificar se é necessário)
systemctl stop gnome-remote-desktop
systemctl disable gnome-remote-desktop
systemctl mask gnome-remote-desktop
echo "gnome-remote-desktop desabilitado"

# ═══════════════════════════════════════════════════════════════════
# 4. SENHAS — POLÍTICA DE EXPIRAÇÃO
# ═══════════════════════════════════════════════════════════════════

# Instalar libpam-pwquality
apt install -y libpam-pwquality

# Complexidade de senha
cat > /etc/security/pwquality.conf << 'EOF'
minlen = 16
dcredit = -1  # pelo menos 1 dígito
ucredit = -1  # pelo menos 1 maiúscula
lcredit = -1  # pelo menos 1 minúscula
ocredit = -1  # pelo menos 1 caractere especial
maxrepeat = 3  # máx 3 caracteres repetidos
gecoscheck = 1  # não pode conter nome do usuário
EOF

# Alterar política para usuário existente
chage -M 90 -m 7 -W 14 will
echo "Política de senhas configurada para usuário will"

# Para root (se existir):
# chage -M 90 -m 7 -W 14 root

# Verificar
chage -l will

# ═══════════════════════════════════════════════════════════════════
# 5. USUÁRIO sync — REMOVER SHELL
# ═══════════════════════════════════════════════════════════════════
usermod -s /usr/sbin/nologin sync
echo "Usuário sync com shell /usr/sbin/nologin"

# Verificar outros usuários com shell que não deveriam
cut -d: -f1,7 /etc/passwd | grep -E "/(bash|sh)$" | grep -v root | grep -v will

# ═══════════════════════════════════════════════════════════════════
# 6. JAVA — REMOVER SE NÃO USAR
# ═══════════════════════════════════════════════════════════════════
# Verificar se Java é usado antes de remover
dpkg -l | grep -i java | grep "^ii"
# Se não usado:
apt purge -y default-jre default-jre-headless openjdk-21-jre openjdk-21-jre-headless java-common
apt autoremove -y
echo "Java runtime removido"

# Se precisar de Java depois:
# apt install -y openjdk-21-jre-headless

# ═══════════════════════════════════════════════════════════════════
# 7. APT SOURCES — MIGRAR HTTP → HTTPS
# ═══════════════════════════════════════════════════════════════════
sed -i 's|http://archive.ubuntu.com|https://archive.ubuntu.com|g' /etc/apt/sources.list.d/*.list
sed -i 's|http://security.ubuntu.com|https://security.ubuntu.com|g' /etc/apt/sources.list.d/*.list
apt update -qq
echo "Sources migrados para HTTPS"

# ═══════════════════════════════════════════════════════════════════
# 8. CORE DUMPS — DESABILITAR
# ═══════════════════════════════════════════════════════════════════
echo "* hard core 0" >> /etc/security/limits.conf
echo "kernel.core_pattern = |/bin/false" >> /etc/sysctl.conf
sysctl -p
echo "Core dumps desabilitados"

# ═══════════════════════════════════════════════════════════════════
# 9. ICMP/ping — BROADCAST PROTECTION
# ═══════════════════════════════════════════════════════════════════
# Adiciona APENAS se ainda não existir (evita duplicatas em re-execução)
grep -q "icmp_echo_ignore_broadcasts" /etc/sysctl.conf || \
cat >> /etc/sysctl.conf << 'EOF'
# ICMP
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
EOF
sysctl -p
echo "ICMP hardening aplicado"

# ═══════════════════════════════════════════════════════════════════
# 10. SWAP — DESABILITAR EM HOST DE PRODUÇÃO (opcional)
# ═══════════════════════════════════════════════════════════════════
# Verificar uso atual
free -h
# Se ZFS + 32GB+ RAM, considerar swapoff
# swapoff -a
# comment swap line in /etc/fstab

# ═══════════════════════════════════════════════════════════════════
# 11. SYN FLOOD PROTECTION
# ═══════════════════════════════════════════════════════════════════
grep -q "tcp_syncookies" /etc/sysctl.conf || \
cat >> /etc/sysctl.conf << 'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_syn_retries = 2
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_max_syn_backlog = 4096
EOF
sysctl -p
echo "SYN flood protection aplicado"

# ═══════════════════════════════════════════════════════════════════
# 12. AUDIT — REGISTRO DE COMANDOS PERIGOSOS
# ═══════════════════════════════════════════════════════════════════
cat >> /etc/audit/rules.d/hardening.rules << 'EOF'
# Regra: monitorar comandos de modificação de usuário
-w /usr/sbin/useradd -p always,exit -F arch=b64 -S execve -k user_mod
-w /usr/sbin/usermod -p always,exit -F arch=b64 -S execve -k user_mod
-w /usr/sbin/userdel -p always,exit -F arch=b64 -S execve -k user_mod
-w /usr/sbin/groupadd -p always,exit -F arch=b64 -S execve -k group_mod
-w /usr/bin/chage -p always,exit -F arch=b64 -S execve -k passwd_change
# Monitorar sshd_config
-w /etc/ssh/sshd_config -p wa -k sshd_config
-w /etc/ssh/sshd_config.d/ -p wa -k sshd_config
EOF
augenrules --load 2>/dev/null || echo "audit rules criados (reboot para carregar)"
echo "Auditoria configurada"

# ═══════════════════════════════════════════════════════════════════
# 13. LOGIN — FALHA LOGIN ANTIBRUTE
# ═══════════════════════════════════════════════════════════════════
# fail2ban já instalado e rodando — verificar configuração
cat /etc/fail2ban/jail.local 2>/dev/null || cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3

[sshd]
enabled = true
port = 2222
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

systemctl restart fail2ban
echo "fail2ban verificado"

# ═══════════════════════════════════════════════════════════════════
# 14. ATUALIZAR TUDO
# ═══════════════════════════════════════════════════════════════════
# ⚠️ NÃO USE apt upgrade OU apt full-upgrade — isso quebra NVIDIA, ZFS, kernel
# O unattended-upgrades (seção 1) já faz atualizações de segurança automaticamente
# Se precisar forçar update crítico de segurança:
#   sudo unattended-upgrade -d --dry-run  # ver o que seria atualizado
#   sudo unattended-upgrade               # executar (não reinicia automaticamente)
echo "Updates de seguranca gerenciados via unattended-upgrades (seção 1)"

# ═══════════════════════════════════════════════════════════════════
# VERIFICAÇÃO FINAL
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "═══ VERIFICAÇÃO FINAL ═══"
echo ""
echo "Serviços desabilitados:"
systemctl list-units --type=service --state=inactive | grep -E "avahi|cups|ModemManager|snapd|kerneloops|gnome-remote-desktop" | awk '{print "  " $1}'
echo ""
echo "Firewall UFW:"
ufw status verbose | grep -E "^Status:|^Default:|^[0-9]"
echo ""
echo "Password policy:"
chage -l will | grep -E "Password expires|Maximum|Minimum"
echo ""
echo "Unattended upgrades:"
cat /etc/apt/apt.conf.d/99security 2>/dev/null || echo "  Verificar manualmente"
echo ""
echo "Core dumps:"
grep "core" /etc/security/limits.conf
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  REBOOT RECOMENDADO para aplicar todas mudanças"
echo "═══════════════════════════════════════════════════════════"
```

---

## Regra de Ouro — Nunca Fazer

```bash
# ❌ NUNCA use apt upgrade / apt dist-upgrade no host
#     Isso pode quebrar drivers NVIDIA, kernel modules, ZFS
#     O UNATTENDED_UPGRADE faz patches de segurança automaticamente

# ✅ USE para atualizar:
#     - Coolify: via coolify-lock.sh
#     - Docker images: via Coolify UI
#     - NVIDIA: NÃO atualizar (driver está funcionando)
#     - Kernel: NÃO atualizar (6.17.0-20 é a versão pinned)
```

---

## Checklist Pós-Hardening

```bash
# Após rodar o script e rebootar, verificar:

# 1. Firewall
ufw status verbose

# 2. Serviços removidos
systemctl status avahi-daemon
systemctl status cups-browsed
systemctl status gnome-remote-desktop

# 3. Unattended upgrades ativo
systemctl status unattended-upgrades
cat /var/log/unattended-upgrades/unattended-upgrades.log | tail -5

# 4. Política de senhas
chage -l will

# 5. Atualizações automáticas funcionando
apt list --upgradable 2>/dev/null | head -10

# 6. Auditoria de login
ausearch -k user_mod -i | tail -10

# 7. Portas expostas (só as esperadas)
ss -tlnp | grep -v docker
```

---

## Mapa de Portas Expostas — Correto

```
EXPOSTAS em 0.0.0.0 (TODAS interfaces) — risco:
  :2222   SSH (hardened ✅, porta alternativa)
  :3300   Gitea MySQL ⚠️  → PROTEGIDO pelo UFW rule
  :6001   Soketi realtime ⚠️  → Cloudflare Tunnel?
  :6002   Soketi ⚠️
  :631    CUPS ⚠️  → DESABILITADO junto com serviço
  :8000   Coolify ⚠️   → Cloudflare Tunnel ou local
  :8080   Traefik dashboard ⚠️ → PROTEGIDO pelo UFW rule

LOOPBACK 127.0.0.1 (SEGURO ✅):
  :6333   Qdrant
  :4000   LiteLLM
  :3100   Grafana
  :11434  Ollama
  :9090   Prometheus
  :8200   Infisical
  :8888   SearXNG
  :6381   Redis (aurelia)
  :6380   Redis (aurelia)
```

## Coolify — SSH Connection Setup (CRÍTICO)

O Coolify precisa de SSH para executar comandos no host como usuário `will` (não root).

### 1. UFW — Permitir Docker0 → Host nas portas 22 e 2222
```bash
# Containers Docker precisam alcançar o host via SSH
# docker0 é a interface bridge do Docker (subrede 10.0.10.0/24)
# Porta 2222 = docker-proxy (redireciona para SSH nativo)
# Porta 22 = SSH nativo do host (USADO PELO COOLIFY SENTINEL)
sudo ufw allow in on docker0 to any port 2222 comment "Coolify SSH proxy"
sudo ufw allow from 10.0.0.0/8 to any port 22 comment "Coolify Docker SSH"

# ⚠️ REGRA CRÍTICA: Sem a regra da porta 22, o ServerConnectionCheckJob
# vai falhar com "Operation timed out" e o Sentinel mostrará "Not Reachable"
```

### 2. Chave Pública do Coolify → authorized_keys
```bash
# Caminho da chave privada do Coolify 4.x
KEY_PATH="/srv/data/coolify/ssh/keys/ssh_key@00000000-0000-0000-0000-000000000000"

# Extrair chave pública e adicionar APENAS se não existir (evita duplicatas)
if ! sudo grep -q "$(sudo ssh-keygen -y -f "$KEY_PATH" 2>/dev/null)" /home/will/.ssh/authorized_keys 2>/dev/null; then
    sudo ssh-keygen -y -f "$KEY_PATH" | sudo tee -a /home/will/.ssh/authorized_keys > /dev/null
    echo "Chave Coolify adicionada"
else
    echo "Chave Coolify ja presente"
fi

# Corrigir permissões
sudo chown will:will /home/will/.ssh/authorized_keys
sudo chmod 600 /home/will/.ssh/authorized_keys
```

**NOTA:** Coolify 4.x usa formato `ssh_key@UUID` em `/srv/data/coolify/ssh/keys/` (não `id.root@host.docker.internal.pub` de versões anteriores).

### 3. Verificar Permissões do Usuário `will`
```bash
# will deve estar no grupo docker (para executar docker commands)
groups will
# Esperado: will : will adm cdrom sudo dip plugdev users lpadmin docker ollama

# Se não estiver:
sudo usermod -aG docker will
```

### 4. Validação
```bash
# Testar que a chave foi adicionada
tail -1 /home/will/.ssh/authorized_keys
# Deve começar com: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5...

# Ver regras UFW
sudo ufw status | grep -E "2222|docker0"
# Deve mostrar: 2222 on docker0 ALLOW
```

---

## Coolify — O Que NÃO Hardening

O Coolify NÃO deve ter firewall entre Coolify e os serviços internos dele:

```
UFW rules para Coolify:

ALLOW 10.0.0.0/8 → :8000    # Rede Docker interna
ALLOW 172.16.0.0/12 → :8000  # Rede Docker
ALLOW 192.168.0.0/16 → :8000  # LAN
DENY  :8000 (wan)              # Block direct, usar tunnel

# Traefik dashboard :8080 — deny external, só localhost
DENY  any → :8080              # Traefik dashboard

# Gitea MySQL :3300 — deny external, só Docker internal
DENY  any → :3300              # MySQL exposto

# Cloudflare Tunnel (cloudflared) já é o proxy de entrada
# Não precisa abrir portas extras no host para serviços tunnelados
```

---

## Monitoramento Contínuo

```bash
# Verificar semanalmente:
# 1. Servicios rodando
systemctl list-units --type=service --state=running --no-pager | grep -v docker | grep -v systemd

# 2. Unattended upgrades logs
journalctl -u unattended-upgrades --since "7 days ago" | tail -20

# 3. Tentativas de login falhas
faillock --user will --failed
faillock --user root --failed
journalctl -u ssh | grep -i "failed" | tail -10

# 4. auditd events
ausearch -k sshd_config -i | tail -10
ausearch -k user_mod -i | tail -10

# 5. Coolify SSH connection
grep -q "coolify-generated\|phpseclib-generated-key" /home/will/.ssh/authorized_keys && echo "OK: Coolify SSH key presente" || echo "ERRO: Coolify SSH key NAO encontrada"
sudo ufw status | grep -qE "2222 on docker0|2222 .v6. on docker0" && echo "OK: UFW docker0→2222" || echo "ERRO: UFW docker0→2222 FALTANDO"
sudo ufw status | grep -qE "22.*10.0.0.0|10.0.0.0.*22" && echo "OK: UFW Docker→port22" || echo "ERRO: UFW Docker→port22 FALTANDO"

# 6. Updates pendentes
apt list --upgradable 2>/dev/null
```

---

## Referências

| Recurso | URL |
|---------|-----|
| CIS Ubuntu 24.04 Benchmark | `cisofy.com/lynis` |
| Ubuntu Security | `ubuntu.com/security` |
| manter_infisical.md | Secrets e vault |
| UFW Docs | `man.ubuntu.com/man/ufw` |
| Unattended-Upgrades | `github.com/mvo5/unattended-upgrades` |

---

*Security Hardening — will-zappro | Auditoria: 2026-04-04*
