#!/bin/bash
# ============================================================
# HERMES SECURITY HARDENING SCRIPT — Homelab Ubuntu Server
# Autor: Hermes Agent | Owner: William Rodrigues
# Uso: curl -fsSL https://... | bash
# Ou: bash security-hardening.sh
# ============================================================
set -euo pipefail

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; RESET='\033[0m'

log() { echo -e "${GREEN}[✓]${RESET} $1"; }
warn() { echo -e "${YELLOW}[!]${RESET} $1"; }
fail() { echo -e "${RED}[✗]${RESET} $1"; }
info() { echo -e "${BLUE}[i]${RESET} $1"; }

# Pré-requisito: root
if [[ $EUID -ne 0 ]]; then
   fail "Este script precisa de root. Usa: sudo bash $0"
   exit 1
fi

# Backup antes de tudo
BACKUP_DIR="/srv/backups/security-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
log "Backup inicial → $BACKUP_DIR"

# ============================================================
# FASE 1 — Atualização do sistema
# ============================================================
info "FASE 1: Atualização do sistema..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades apt-listchanges \
  iptables-persistent net-tools curl wget jq > /dev/null 2>&1
log "Sistema atualizado e pacotes instalados"

# ============================================================
# FASE 2 — UFW Hardening
# ============================================================
info "FASE 2: UFW Hardening..."

# Backup das regras atuais
cp -r /etc/ufw "$BACKUP_DIR/ufw-backup" 2>/dev/null || true

# Reset UFW
ufw --force reset

# Políticas padrão: tudo bloqueado exceto o necessário
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed

# Portas essenciais — AJUSTA conforme teu ambiente
ufw allow 22/tcp comment 'SSH'          # SSH (muda se usar porta diferente)
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 3000/tcp comment 'Coolify'
ufw allow 6333/tcp comment 'Qdrant'
ufw allow 8000/tcp comment 'Trieve'

# Rate limit SSH (6 conexões por 30 segundos)
ufw limit 22/tcp

# Docker — permite contêineres específicos
ufw allow from 10.0.0.0/24 to any port 2375 comment 'Docker (interno)' 2>/dev/null || true
ufw allow from 10.0.0.0/24 to any port 2376 comment 'Docker TLS (interno)' 2>/dev/null || true

# Enable UFW
echo "y" | ufw enable > /dev/null 2>&1 || true
ufw reload

# Habilita no boot
systemctl enable ufw > /dev/null 2>&1 || true

log "UFW configurado — Status:"
ufw status verbose | grep -E "Status|To|Action"

# ============================================================
# FASE 3 — SSH Hardening
# ============================================================
info "FASE 3: SSH Hardening..."

SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "$BACKUP_DIR/sshd_config.backup"

# Linhas de hardening
declare -A SSH_HARDENING=(
  ["PermitRootLogin"]="no"
  ["PasswordAuthentication"]="no"
  ["ChallengeResponseAuthentication"]="no"
  ["X11Forwarding"]="no"
  ["MaxAuthTries"]="3"
  ["ClientAliveInterval"]="300"
  ["ClientAliveCountMax"]="2"
  ["LogLevel"]="VERBOSE"
  ["PermitEmptyPasswords"]="no"
  ["AllowAgentForwarding"]="no"
  ["AllowTcpForwarding"]="no"
  ["MaxSessions"]="2"
)

for key in "${!SSH_HARDENING[@]}"; do
  value="${SSH_HARDENING[$key]}"
  if grep -q "^#*${key}" "$SSHD_CONFIG"; then
    sed -i "s/^#*\(${key}\).*/\1 $value/" "$SSHD_CONFIG"
  else
    echo "$key $value" >> "$SSHD_CONFIG"
  fi
done

# Restart SSH
systemctl restart sshd
log "SSH endurecido — reiniciado"

# ============================================================
# FASE 4 — Fail2ban
# ============================================================
info "FASE 4: Fail2ban..."

JAIL_LOCAL="/etc/fail2ban/jail.local"
cat > "$JAIL_LOCAL" << 'JAIL_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
destemail = root@localhost
sender = root@hermes
action = %(action_mwl)s

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[sshd-ddos]
enabled = true
port = 22
filter = sshd-ddos
logpath = /var/log/auth.log
maxretry = 10

[http-get-dos]
enabled = true
port = 80,443
filter = http-get-dos
logpath = /var/log/apache2/access.log
maxretry = 100
findtime = 60
bantime = 600

[nginx-http-auth]
enabled = true
port = 80,443
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
JAIL_EOF

systemctl enable fail2ban > /dev/null 2>&1
systemctl restart fail2ban
log "Fail2ban ativo"
fail2ban-client status 2>/dev/null | head -5 || true

# ============================================================
# FASE 5 — Docker Security
# ============================================================
info "FASE 5: Docker Security..."

# Firewall Docker — não abre portas desnecessárias
# Docker daemon.json hardening
DOCKER_DAEMON="/etc/docker/daemon.json"
mkdir -p /etc/docker
if [ ! -f "$DOCKER_DAEMON" ]; then
  cat > "$DOCKER_DAEMON" << 'EOF'
{
  "icc": false,
  "userns-remap": "default",
  "live-restore": true,
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": { "Name": "nofile", "Hard": 64000, "Soft": 64000 }
  }
}
EOF
  systemctl restart docker
  log "Docker daemon.json endurecido"
else
  warn "Docker daemon.json já existe — a verificar..."
  grep -q "no-new-privileges" "$DOCKER_DAEMON" && log "Já endurecido" || warn "Adicionar no-new-privileges manualmente"
fi

# ============================================================
# FASE 6 — Sysctl Hardening
# ============================================================
info "FASE 6: Sysctl Network Hardening..."

SYSCTL_FILE="/etc/sysctl.d/99-hermes-security.conf"
cat > "$SYSCTL_FILE" << 'SYSCTL_EOF'
# IP Spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Desativar IP forwarding se não necessário
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_syn_retries = 2
net.ipv4.tcp_synack_retries = 2

# Ignore ICMP broadcast
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Ignore bogus ICMP
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Desativar source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# TCP timestamps — desativar (reduz fingerprinting)
net.ipv4.tcp_timestamps = 0

# TCP keepalive
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 3
SYSCTL_EOF

sysctl -p "$SYSCTL_FILE" > /dev/null 2>&1
log "Sysctl endurecido"

# ============================================================
# FASE 7 — Auditoria de Portas Abertas
# ============================================================
info "FASE 7: Auditoria de Portas..."

echo ""
echo "=== PORTAS TCP EM ESCUTA (servidor) ==="
ss -tlnp | awk 'NR>1 {print $4}' | sort -u

echo ""
echo "=== PORTAS UDP EM ESCUTA ==="
ss -ulnp | awk 'NR>1 {print $4}' | sort -u

echo ""
echo "=== SERVIÇOS ATIVOS (systemd) ==="
systemctl list-units --type=service --state=running \
  --no-pager --no-legend | grep -v "^sys-" | awk '{print $1}' | sort

echo ""
echo "=== PROCESSOS COM PORTAS INTERESSANTES ==="
for port in 22 80 443 2375 2376 3000 4000 6333 8000 8204; do
  result=$(ss -tlnp 2>/dev/null | grep ":$port ")
  if [ -n "$result" ]; then
    echo "  Porta $port: $result"
  fi
done

# ============================================================
# FASE 8 — unattended-upgrades
# ============================================================
info "FASE 8: Updates automáticos..."

dpkg-reconfigure -plow unattended-upgrades 2>/dev/null || true
# Force
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/99periodic
echo 'APT::Periodic::Download-Upgradeable-Packages "1";' >> /etc/apt/apt.conf.d/99periodic
echo 'APT::Periodic::AutocleanInterval "7";' >> /etc/apt/apt.conf.d/99periodic
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/99periodic

# ============================================================
# FASE 9 — ZFS Snapshot Policy (se ZFS existe)
# ============================================================
info "FASE 9: ZFS snapshot policy..."

if command -v zfs &> /dev/null; then
  POOLS=$(zpool list -H -o name 2>/dev/null)
  for pool in $POOLS; do
    # Snapshots automáticos (diário, semanal, mensal)
    zfs set com.sun:auto-snapshot=true "$pool" 2>/dev/null || true
    # Comprimir snapshots
    zfs set compression=lz4 "$pool" 2>/dev/null || true
  done
  log "ZFS auto-snapshot ativado"
else
  info "ZFS não encontrado — saltando"
fi

# ============================================================
# FASE 10 — Relatório Final
# ============================================================
echo ""
echo "============================================"
echo "   HERMES SECURITY HARDENING — CONCLUÍDO"
echo "============================================"
echo ""
echo "Backup: $BACKUP_DIR"
echo ""
echo "=== UFW Status ==="
ufw status numbered | head -20
echo ""
echo "=== Fail2ban Jails ==="
fail2ban-client status 2>/dev/null | grep -E "Jail|Version" || true
echo ""
echo "=== Sysctl loaded ==="
sysctl net.ipv4.tcp_syncookies net.ipv4.conf.all.rp_filter \
  net.ipv4.conf.all.accept_redirects net.ipv4.icmp_echo_ignore_broadcasts \
  2>/dev/null | grep "=" | sort
echo ""
echo "=== Próximos passos MANUAIS ==="
echo "  1. Verificar acesso SSH (nova conexão noutro terminal)"
echo "  2. Gerar chave SSH: ssh-keygen -t ed25519 -C \"hermes@$HOSTNAME\""
echo "  3. Testar Tailscale: curl -fsSL https://tailscale.com/install.sh | sh"
echo "  4. Verificar Docker: docker run --rm -it --security-opt no-new-privileges:true alpine sh"
echo ""
echo "Para reverter: cp -r $BACKUP_DIR/ufw-backup /etc/ufw && cp $BACKUP_DIR/sshd_config.backup $SSHD_CONFIG"
echo ""
