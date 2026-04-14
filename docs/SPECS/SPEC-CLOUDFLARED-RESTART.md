# SPEC-CLOUDFLARED-RESTART — Cloudflared Daemon Restart & Watchdog Hardening

**Data:** 2026-04-14
**Status:** Análise Completa / Runbook Preparado
**Túnel:** `homelab-tunnel` (ID: `aee7a93d-c2e2-4c77-a395-71edc1821402`)

---

## 1. Estado Atual

| Componente                              | Estado                                               |
| --------------------------------------- | ---------------------------------------------------- |
| systemd service (`cloudflared.service`) | **inactive (dead)** desde 07:42:34                   |
| Processo manual (PID 3275599)           | **ATIVO** há ~2h (tunnel `homelab-tunnel`)           |
| Origem hermes.zappro.site (:8642)       | **connection refused** no momento da morte do daemon |
| Origem bot.zappro.site (:8642)          | **connection refused** no momento da morte do daemon |

### Evidência do Journal

```
Apr 14 07:42:34 homelab cloudflared[2046130]: INF Initiating graceful shutdown due to signal terminated ...
Apr 14 07:42:34 homelab cloudflared[2046130]: ERR failed to serve tunnel connection error="accept stream listener..."
Apr 14 07:42:34 homelab cloudflared[2046130]: INF no more connections active and exiting
Apr 14 07:42:34 homelab cloudflared[2046130]: INF Tunnel server stopped
Apr 14 07:42:34 homelab systemd[1]: cloudflared.service: Deactivated successfully.
Apr 14 07:42:34 homelab systemd[1]: cloudflared.service: Consumed 51.437s CPU time
```

---

## 2. Causa Raiz

**O daemon NÃO crashou.** Ele recebeu `SIGTERM` (sinal 15 — terminação graciosa) e saiu com `status=0/SUCCESS`.

Possíveis origens do SIGTERM:

- **Intervenção manual** — alguém executou `systemctl stop cloudflared` ou `kill <pid>`
- **OOM Killer** — improvável, pois o journal não mostra `OOMKilled` e o exit code é 0
- **RestartPolicy mal configurado** — `Restart=on-failure` não reinicia em exit code 0

**Nota:** Antes do shutdown, o daemon estava com erros de `connection refused` para `10.0.5.2:8642` (Hermes Agent). O túnel da Cloudflare ainda funciona porque o processo manual (PID 3275599) continua ativo.

---

## 3. Diagnóstico Pré-Restart

```bash
# 1. Verificar se cloudflared daemon está rodando
pgrep -a cloudflared

# 2. Verificar se o túnel ainda está ativo (processo manual)
ps -p <PID> -o pid,etime,cmd

# 3. Status do systemd
systemctl status cloudflared

# 4. Journal recente
journalctl -u cloudflared --since "07:00" | tail -30

# 5. Testar conectividade às origens
curl -s -o /dev/null -w "%{http_code}" http://localhost:8642/health 2>/dev/null || echo "hermes unreachable"
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null || echo "llm unreachable"
```

---

## 4. Restart Gracioso vs. Force

### 4.1 Restart Gracioso (Preferred)

Usar quando o processo manual está saudável e não há urgência.

```bash
# Não há kill — o processo manual continua.
# Apenas restart o systemd para que ele reassuma o tunnel.

sudo systemctl daemon-reload
sudo systemctl start cloudflared
sleep 5
sudo systemctl status cloudflared
```

**Problema:** Dois processos `cloudflared tunnel run` simultâneos competindo pelo mesmo túnel.
**Solução:** Matar o processo manual ANTES de iniciar o systemd, OU usar `--force` no restart.

### 4.2 Restart Force (Recomendado para este caso)

O processo manual está rodando há 2h. Para assumir o túnel via systemd:

```bash
# PASSO 1 — Identificar o PID do processo manual
pgrep -a cloudflared
# Saída esperada: 3275599 cloudflared --config /home/will/.cloudflared/config.yml tunnel run homelab-tunnel

# PASSO 2 — Parar o processo manual graciosamente
sudo kill -15 3275599   # SIGTERM
sleep 3

# PASSO 3 — Verificar se parou
ps -p 3275599 && echo "AINDA ATIVO" || echo "PARADO"

# PASSO 4 — Se ainda ativo, force kill
sudo kill -9 3275599

# PASSO 5 — Iniciar via systemd
sudo systemctl start cloudflared
sleep 5

# PASSO 6 — Verificar
systemctl status cloudflared
pgrep -a cloudflared
```

### 4.3 Restart Sem Parar o Manual (Zero-Downtime)

Se o túnel TEM que continuar ativo durante o restart:

```bash
# O processo manual continua rodando.
#cloudflared daemon Assume o túnel quando iniciado.
# ⚠️ PROBLEMA: Dois processos no mesmo túnel = conflito.

# Neste caso, PREFERIR manter o manual até a próxima janela de manutenção.
# O systemd service pode ficar inativo até lá.
```

---

## 5. Verificação Pós-Restart

```bash
# 1. Ver systemd
systemctl status cloudflared
# Esperado: Active: active (running)

# 2. Ver processo
pgrep -a cloudflared
# Esperado: exatamente 1 processo cloudflared

# 3. Ver journal por erros recentes
journalctl -u cloudflared --since "1 minute ago" | grep -i err
# Esperado: nenhum erro ERR

# 4. Testar túnel externo (de fora da rede)
curl -s -o /dev/null -w "%{http_code}" https://hermes.zappro.site/chat
# Esperado: 200 (ou redirect, não 502/524)

# 5. Verificar outras rotas do túnel
curl -s -o /dev/null -w "%{http_code}" https://api.zappro.site/health
curl -s -o /dev/null -w "%{http_code}" https://chat.zappro.site/
```

---

## 6. Health Check Endpoint

O cloudflared expõe métricas localmente. Adicionar ao systemd service:

```ini
[Service]
# Health check via metrics endpoint
ExecStartPost=/bin/bash -c 'until curl -sf http://localhost:35767/metrics > /dev/null; do sleep 2; done'
```

O metrics endpoint padrão do cloudflared está em `localhost:35767` (ou `localhost:35889` dependendo da instalação).

### Script de Health Check Standalone

```bash
#!/bin/bash
# /srv/ops/scripts/cloudflared-healthcheck.sh

METRICS_URL="http://localhost:35767/metrics"
TUNNEL_NAME="homelab-tunnel"

# Check 1: Daemon vivo
if ! pgrep -f "cloudflared.*tunnel run.*$TUNNEL_NAME" > /dev/null; then
    echo "FAIL: cloudflared tunnel not running"
    exit 1
fi

# Check 2: Metrics endpoint reachable
if ! curl -sf "$METRICS_URL" > /dev/null 2>&1; then
    echo "FAIL: metrics endpoint unreachable"
    exit 1
fi

# Check 3: Tunnel connected (active connections > 0 in metrics)
CONN_COUNT=$(curl -sf "$METRICS_URL" 2>/dev/null | grep "cloudflared_tunnel_active_connections" | awk '{print $2}')
if [ -z "$CONN_COUNT" ] || [ "$CONN_COUNT" -eq 0 ]; then
    echo "WARN: tunnel has no active connections (may be idle)"
fi

echo "OK: cloudflared tunnel running"
exit 0
```

Tornar executável:

```bash
chmod +x /srv/ops/scripts/cloudflared-healthcheck.sh
```

---

## 7. Hardening do Systemd Service — Watchdog

### 7.1 Problemas do Service File Atual

```ini
# Current — problemas:
Restart=on-failure    # Não reinicia em exit code 0 (graceful SIGTERM)
RestartSec=5          # OK, mas sem watchdog mechanism
# Sem WatchdogSec     # O cloudflared não envia keep-alive ao systemd
```

### 7.2 Service File Melhorado

```ini
[Unit]
Description=Cloudflare Tunnel (homelab-tunnel)
After=network.target
Wants=network.target

[Service]
Type=simple
User=will
WorkingDirectory=/home/will/.cloudflared
ExecStart=/usr/local/bin/cloudflared tunnel run --credentials-file /home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json homelab-tunnel

# Restart policy — reinicia em qualquer saída não-zero OU SIGTERM
Restart=always
RestartSec=5

# Watchdog — systemd pinga o processo; se não responder em 30s, mata e reinicia
WatchdogSec=30

# Logs — prevents journal truncation
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflared

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 7.3 Aplicar

```bash
sudo cp /etc/systemd/system/cloudflared.service /etc/systemd/system/cloudflared.service.bak.$(date +%Y%m%d%H%M%S)
sudo bash -c 'cat > /etc/systemd/system/cloudflared.service << '\''EOF'\''
[Unit]
Description=Cloudflare Tunnel (homelab-tunnel)
After=network.target
Wants=network.target

[Service]
Type=simple
User=will
WorkingDirectory=/home/will/.cloudflared
ExecStart=/usr/local/bin/cloudflared tunnel run --credentials-file /home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json homelab-tunnel
Restart=always
RestartSec=5
WatchdogSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflared
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
```

---

## 8. Runbook — Resumo de Comandos

### 8.1 restart-gracioso.sh

```bash
#!/bin/bash
set -euo pipefail

TUNNEL_NAME="homelab-tunnel"
CRED_FILE="/home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json"
MANUAL_PID=$(pgrep -f "cloudflared.*$TUNNEL_NAME" | head -1 || true)

echo "=== Cloudflared Restart ==="
echo "Manual PID: $MANUAL_PID"

if [ -n "$MANUAL_PID" ]; then
    echo "[1/4] Stopping manual process ($MANUAL_PID)..."
    kill -15 "$MANUAL_PID"
    sleep 5
    if ps -p "$MANUAL_PID" > /dev/null 2>&1; then
        echo "[WARN] Process still alive, sending SIGKILL..."
        kill -9 "$MANUAL_PID"
        sleep 2
    fi
    echo "[OK] Manual process stopped"
fi

echo "[2/4] Reloading systemd..."
systemctl daemon-reload

echo "[3/4] Starting cloudflared via systemd..."
systemctl restart cloudflared
sleep 5

echo "[4/4] Verifying..."
systemctl status cloudflared --no-pager
pgrep -a cloudflared

# Quick connectivity test
echo ""
echo "=== Connectivity Test ==="
for host in hermes api chat coolify git grafana list llm md monitor n8n painel qdrant vault; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${host}.zappro.site/" 2>/dev/null || echo "FAIL")
    printf "%-20s %s\n" "${host}.zappro.site:" "$code"
done
```

### 8.2 emergencia-imediata.sh

```bash
#!/bin/bash
# EMERGÊNCIA: matar tudo e restartar imediatamente
set -e

echo "[EMERGENCY] Killing all cloudflared processes..."
pkill -9 cloudflared || true
sleep 2

echo "[EMERGENCY] Starting via systemd..."
systemctl daemon-reload
systemctl restart cloudflared

sleep 5
echo "[EMERGENCY] Status:"
systemctl status cloudflared --no-pager
```

---

## 9. Tarefas Pendentes

- [ ] Executar runbook de restart (escolher janela de manutenção ou forçar agora)
- [ ] Aplicar service file melhorado com `Restart=always` + `WatchdogSec=30`
- [ ] Criar health check script em `/srv/ops/scripts/cloudflared-healthcheck.sh`
- [ ] Adicionar health check ao cron ou ao agente de monitoring (SPEC-023)
- [ ] Investigar por que Hermes Agent (:8642) estava unreachable às 07:40-07:42
- [ ] Atualizar SUBDOMAINS.md se necessário

---

## 10. Referências

- Cloudflare Tunnel Docs: `cloudflared tunnel run`
- systemd.service(5): `WatchdogSec`, `Restart`
- Journal: `journalctl -u cloudflared -f` para monitoring em tempo real
- SPEC-043: Subdomain Prune & Hermes Migration (ghost entries de bot/supabase)
