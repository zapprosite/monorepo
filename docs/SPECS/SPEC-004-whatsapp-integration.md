# SPEC-004: WhatsApp Integration

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-001, SPEC-002

---

## Objective

Integrar WhatsApp Cloud API: webhook receiver + message sender.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Webhook | net/http POST /webhook |
| Send | Facebook Graph API |
| Validation | X-Hub-Signature-256 |

---

## Flow

```
WhatsApp → Webhook → intake_agent → classifier → ... → response → WhatsApp Cloud API → User
```

---

## Webhook Payload (Inbound)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BIZ_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {"phone_number_id": "PH_ID"},
        "contacts": [{"profile": {"name": "João"}, "wa_id": "5511999887766"}],
        "messages": [{
          "from": "5511999887766",
          "id": "wamid.xxx",
          "timestamp": "1712534280",
          "type": "text",
          "text": {"body": "Erro E4 no split Carrier?"}
        }]
      }
    }]
  }]
}
```

---

## HTTP Handlers

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /webhook | POST | WhatsApp inbound |
| /webhooks/stripe | POST | Stripe webhooks |
| /api/swarm/board | GET | SSE dashboard |
| /api/swarm/tasks | POST | Admin task inject |

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Webhook validates X-Hub-Signature-256 | Invalid = 403 |
| AC-2 | Message extracted correctly | Unit test payload parsing |
| AC-3 | Response sent via Graph API | curl mock |
| AC-4 | SSE board streams events | curl -N http://localhost:8080/api/swarm/board |
