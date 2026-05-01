#!/bin/bash
# install-supervisor-api.sh — Install Hermes Supervisor API as systemd service
set -euo pipefail

SERVICE_NAME="hermes-supervisor-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
API_SCRIPT="/srv/monorepo/services/api/supervisor_api.py"
LOG_DIR="/srv/ops/logs"
PID_DIR="/run"

mkdir -p "${LOG_DIR}"

cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=Hermes Supervisor API — FastAPI + Rate Limiter
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=will
WorkingDirectory=/srv/monorepo
ExecStart=/usr/bin/python3 ${API_SCRIPT} --port 8092
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/${SERVICE_NAME}.log
StandardError=append:${LOG_DIR}/${SERVICE_NAME}.error.log
Environment="PYTHONPATH=/srv/monorepo/services"

# Security
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${LOG_DIR}:${PID_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}
echo "✅ Supervisor API installed: ${SERVICE_NAME}"
echo "   Status: systemctl status ${SERVICE_NAME}"
echo "   API:    http://localhost:8092/docs"
