#!/bin/bash
#
# scan-chinese-cron.sh
# Cron job para verificar caracteres chineses diariamente.
# Uso: chame via cron, ex:
#   0 3 * * * bash /srv/monorepo/.claude/skills/hvac-guided-triage/scripts/scan-chinese-cron.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
LOG_FILE="/tmp/chinese-scan-$(date +%Y%m%d-%H%M%S).log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOCK_FILE="/tmp/chinese-scan.lock"

# Evitar execuções paralelas
exec 200>"$LOCK_FILE"
flock -n 200 || { echo "Scan já está rodando"; exit 0; }

cd "$MONOREPO_DIR"

echo "=== Chinese Scan Cron - $(date -Iseconds) ===" > "$LOG_FILE"
echo "Monorepo: $MONOREPO_DIR" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Executar scan
if bash "$SCRIPT_DIR/scan-chinese.sh" >> "$LOG_FILE" 2>&1; then
    echo "✅ Scan limpo - nenhum caractere chino não autorizado" >> "$LOG_FILE"
    rm -f "$LOCK_FILE"
    exit 0
else
    echo "❌ PROBLEMAS ENCONTRADOS" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    echo "Últimas 20 linhas:" >> "$LOG_FILE"
    tail -20 "$LOG_FILE" >> "$LOG_FILE"

    # Enviar alerta se email configurado
    if [[ -n "$ALERT_EMAIL" ]]; then
        mail -s "[ALERTA] Caracteres chineses detectados em $(hostname)" "$ALERT_EMAIL" < "$LOG_FILE"
    fi

    rm -f "$LOCK_FILE"
    exit 1
fi
