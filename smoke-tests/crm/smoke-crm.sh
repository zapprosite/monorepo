#!/usr/bin/env bash
# Smoke tests CRM — validar endpoints tRPC
set -e
API="${1:-http://localhost:3000}"
echo "🔍 Smoke CRM: $API"
curl -sf "$API/trpc/leads.list" -H "Content-Type: application/json" >/dev/null && echo "✅ leads.list" || echo "❌ leads.list"
curl -sf "$API/trpc/clients.list" -H "Content-Type: application/json" >/dev/null && echo "✅ clients.list" || echo "❌ clients.list"
curl -sf "$API/trpc/contracts.list" -H "Content-Type: application/json" >/dev/null && echo "✅ contracts.list" || echo "❌ contracts.list"
curl -sf "$API/trpc/equipment.list" -H "Content-Type: application/json" >/dev/null && echo "✅ equipment.list" || echo "❌ equipment.list"
curl -sf "$API/trpc/serviceOrders.list" -H "Content-Type: application/json" >/dev/null && echo "✅ serviceOrders.list" || echo "❌ serviceOrders.list"
curl -sf "$API/trpc/schedule.list" -H "Content-Type: application/json" >/dev/null && echo "✅ schedule.list" || echo "❌ schedule.list"
curl -sf "$API/trpc/reminders.list" -H "Content-Type: application/json" >/dev/null && echo "✅ reminders.list" || echo "❌ reminders.list"
curl -sf "$API/trpc/editorial.list" -H "Content-Type: application/json" >/dev/null && echo "✅ editorial.list" || echo "❌ editorial.list"
curl -sf "$API/health" >/dev/null && echo "✅ health" || echo "❌ health"
curl -sf "http://localhost:8642/health" >/dev/null && echo "✅ context-api :8642" || echo "❌ context-api"
echo "✅ Smoke CRM completo"
