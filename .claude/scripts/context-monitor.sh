#!/bin/bash
# context-monitor.sh — Monitora tamanho da sessão e notifica se precisa summarize
# Usage: context-monitor.sh [check|summary|alert]
# Alerts go to Telegram chat_id 7220607041

set -euo pipefail

TELEGRAM_BOT_TOKEN="$(grep HERMES_AGENCY_BOT_TOKEN /srv/monorepo/.env | cut -d= -f2 | tr -d '"')"
CHAT_ID="7220607041"
SESSION_TRACKER="${HOME}/.hermes/session_tracker.json"
SESSION_SUMMARY="${HOME}/.hermes/session_summary.md"
MAX_LINES=400
MAX_TURNS=50

# ─── Funções ────────────────────────────────────────────────────────────────

send_telegram() {
    local msg="$1"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${CHAT_ID}" \
        -d "text=${msg}" \
        -d "parse_mode=HTML" > /dev/null
}

update_tracker() {
    local turns="$1"
    local topic="${2:-session}"
    local updated
    updated=$(date -Iseconds)
    mkdir -p "$(dirname "$SESSION_TRACKER")"
    echo "{\"last_update\":\"$updated\",\"turns\":$turns,\"topic\":\"$topic\"}" > "$SESSION_TRACKER"
}

get_turns() {
    if [ -f "$SESSION_TRACKER" ]; then
        python3 -c "import json; d=json.load(open('${SESSION_TRACKER}')); print(d.get('turns',0))" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

do_check() {
    local turns
    turns=$(get_turns)
    local msg_count
    msg_count=$(find ~/.hermes/sessions/ -name "*.json" -mtime -1 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")

    if [ "$turns" -ge "$MAX_TURNS" ] || [ "$msg_count" -ge "$MAX_LINES" ]; then
        echo "⚠️  Context size warning: turns=${turns}, lines=${msg_count}"
        do_alert
    else
        echo "✅ Context OK: turns=${turns}, lines=${msg_count}"
        # Increment turns
        new_turns=$((turns + 1))
        update_tracker "$new_turns" "$(python3 -c "import json; d=json.load(open('${SESSION_TRACKER}')) if __import__('os').path.exists('${SESSION_TRACKER}') else {}; print(d.get('topic','session'))" 2>/dev/null || echo 'session')"
    fi
}

do_summary() {
    # Gera summary da sessão atual baseado no tracker
    local topic turns last_update
    topic=$(python3 -c "import json; d=json.load(open('${SESSION_TRACKER}')); print(d.get('topic','session'))" 2>/dev/null || echo 'session')
    turns=$(get_turns)
    last_update=$(python3 -c "import json; d=json.load(open('${SESSION_TRACKER}')); print(d.get('last_update',''))" 2>/dev/null || echo 'unknown')

    mkdir -p "$(dirname "$SESSION_SUMMARY")"
    cat > "$SESSION_SUMMARY" << EOF
# Session Summary

**Topic:** ${topic}
**Turns:** ${turns}
**Last Update:** ${last_update}

## Resumo

EOF

    echo "📋 Summary generated: $SESSION_SUMMARY"
    send_telegram "📋 <b>Session Summary</b>%0A%0A📌 <b>Topic:</b> ${topic}%0A🔢 <b>Turns:</b> ${turns}%0A🕐 <b>Updated:</b> ${last_update}%0A%0AAcción: revisar $SESSION_SUMMARY e fazer summarize se necessário."
}

do_alert() {
    local turns msg_count
    turns=$(get_turns)
    msg_count=$(find ~/.hermes/sessions/ -name "*.json" -mtime -1 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo '?')

    send_telegram "🔴 <b>Contexto Cresceu</b>%0A%0A⚠️  A conversa está com ${turns} turns.%0A%0ARecomendações:%0A• Fazer /ship para salvar estado%0A• Resumir tópicos concluídos%0A• Start novo branch para topics diferentes%0A%0AArquivo: $SESSION_TRACKER"

    # Gera summary automaticamente
    do_summary
}

# ─── Main ─────────────────────────────────────────────────────────────────

CMD="${1:-check}"
case $CMD in
    check)    do_check ;;
    summary)  do_summary ;;
    alert)    do_alert ;;
    *)        echo "Usage: $0 [check|summary|alert]" ;;
esac
