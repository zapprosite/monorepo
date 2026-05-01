#!/bin/bash
# subagent-sre systemd service installer
# Part of SPEC-POLYMER-006 Phase 2

set -euo pipefail

SERVICE_NAME="hermes-sre-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_PATH="/srv/monorepo/services/subagents/subagent-sre.sh"
LOG_DIR="/srv/ops/logs"
METRICS_DIR="/srv/ops/metrics"

mkdir -p "${LOG_DIR}" "${METRICS_DIR}"

cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=Hermes SRE Agent — Infrastructure Monitoring
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=${SCRIPT_PATH} check
StandardOutput=append:${LOG_DIR}/${SERVICE_NAME}.log
StandardError=append:${LOG_DIR}/${SERVICE_NAME}.log
PrivateTmp=yes
NoNewPrivileges=no

# Security
ReadWritePaths=${LOG_DIR}:/srv/ops

[Install]
WantedBy=multi-user.target
EOF

# Timer for every 5 minutes
TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"
cat > "${TIMER_FILE}" << EOF
[Unit]
Description=Hermes SRE Agent Timer — every 5 minutes
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=${SERVICE_NAME}.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}.timer
echo "✅ SRE Agent installed: ${SERVICE_NAME}.service + timer"
echo "   Status: systemctl status ${SERVICE_NAME}.timer"
echo "   Logs:   journalctl -u ${SERVICE_NAME} -f"
