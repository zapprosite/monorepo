#!/bin/bash
# subagent-security systemd service installer
# Part of SPEC-POLYMER-006 Phase 2

set -euo pipefail

SERVICE_NAME="hermes-security-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_PATH="/srv/monorepo/services/subagents/subagent-security.sh"
LOG_DIR="/srv/ops/logs"

mkdir -p "${LOG_DIR}"

cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=Hermes Security Agent — Audit & Monitoring
After=network.target
PartOf=hermes-ops.target

[Service]
Type=oneshot
ExecStart=${SCRIPT_PATH} check
StandardOutput=append:${LOG_DIR}/${SERVICE_NAME}.log
StandardError=append:${LOG_DIR}/${SERVICE_NAME}.alert.log
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"
cat > "${TIMER_FILE}" << EOF
[Unit]
Description=Hermes Security Agent Timer — every 15 minutes
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=3min
OnUnitActiveSec=15min
Unit=${SERVICE_NAME}.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}.timer
echo "✅ Security Agent installed: ${SERVICE_NAME}.service + timer"
