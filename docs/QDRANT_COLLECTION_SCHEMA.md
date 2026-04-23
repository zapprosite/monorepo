# Qdrant Collection Schema — Hermes Agency

**Qdrant Endpoint:** `http://localhost:6333`
**Embedding Model:** `nomic-embed-text` (768 dimensions)
**Distance Metric:** Cosine
**HNSW Index:** `m=16`, `ef_construct=200`

---

## 1. `agency_clients` — Client Profiles

Stores client profiles with health scoring and contact information.

```json
{
  "id": "uuid (primary key)",
  "name": "string",
  "plan": "basic | pro | enterprise",
  "health_score": "float (0-100)",
  "chat_id": "number",
  "created_at": "timestamp (ISO 8601)",
  "metadata": {
    "lead_source": "string",
    "industry": "string",
    "contacts": [
      {
        "name": "string",
        "role": "string",
        "email": "string"
      }
    ]
  }
}
```

**Payload Indexes:** `id`, `plan`, `chat_id`, `created_at`

---

## 2. `agency_campaigns` — Marketing Campaigns

Marketing campaign definitions with budget and performance metrics.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "name": "string",
  "status": "draft | active | paused | completed",
  "created_at": "timestamp (ISO 8601)",
  "budget": "number (decimal)",
  "platforms": ["instagram", "facebook", "tiktok", "twitter", "linkedin", "youtube"],
  "metrics": {
    "impressions": "number (integer)",
    "clicks": "number (integer)",
    "conversions": "number (integer)",
    "spend": "number (decimal)"
  }
}
```

**Payload Indexes:** `id`, `client_id`, `status`, `created_at`

---

## 3. `agency_brand_guides` — Brand Guidelines

Brand guidelines per client including tone of voice, colors, and prohibited terms.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "version": "string (semver, e.g. '2.1.0')",
  "tone_of_voice": "string",
  "colors": {
    "primary": "hex (e.g. '#FF5733')",
    "secondary": "hex",
    "accent": "hex (optional)"
  },
  "prohibited_terms": ["string"],
  "competitors": ["string"],
  "guidelines_text": "string (full brand guidelines content)",
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `version`

---

## 4. `agency_conversations` — Conversation History

Full conversation history per chat session.

```json
{
  "id": "uuid (primary key)",
  "chat_id": "number",
  "client_id": "uuid (FK → agency_clients)",
  "messages": [
    {
      "role": "user | assistant | system",
      "content": "string",
      "timestamp": "timestamp (ISO 8601)"
    }
  ],
  "session_id": "string",
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `chat_id`, `client_id`, `session_id`, `created_at`

---

## 5. `agency_working_memory` — Agent Working Memory

Agent working memory per session for context preservation.

```json
{
  "id": "string (session_id — primary key)",
  "user_id": "string",
  "recent_entries": [
    {
      "role": "string",
      "content": "string",
      "timestamp": "number (unix ms)"
    }
  ],
  "context": {
    "current_skill": "string",
    "current_task": "string",
    "metadata": "object (optional)"
  },
  "last_updated": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `user_id`, `last_updated`

---

## 6. `agency_assets` — Creative Assets

Metadata for creative assets (images, videos, documents).

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "name": "string",
  "type": "image | video | document | audio",
  "url": "string (storage URL)",
  "tags": ["string"],
  "mime_type": "string",
  "size_bytes": "number (integer)",
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `type`, `tags`

---

## 7. `agency_tasks` — Tasks & Deliverables

Agency tasks and deliverables tracking.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "title": "string",
  "description": "string",
  "assignee": "string",
  "status": "pending | in_progress | review | completed | cancelled",
  "priority": "low | medium | high | urgent",
  "due_date": "timestamp (ISO 8601, optional)",
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `status`, `assignee`, `priority`

---

## 8. `agency_video_metadata` — Video Transcription

Video metadata with transcription and key moments.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "asset_id": "uuid (optional, FK → agency_assets)",
  "title": "string",
  "duration_seconds": "number (integer)",
  "transcription": "string (full text)",
  "key_moments": [
    {
      "timestamp": "number (seconds)",
      "label": "string",
      "description": "string"
    }
  ],
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `asset_id`

---

## 9. `agency_knowledge` — Agency Knowledge Base

Internal agency knowledge base documents.

```json
{
  "id": "uuid (primary key)",
  "type": "string (document | procedure | onboarding | policy)",
  "title": "string",
  "content": "string",
  "tags": ["string"],
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `type`, `tags`, `created_at`

---

## Collection Configuration Summary

| Collection | Vector Size | Distance | HNSW m | HNSW ef_construct | Payload Indexes |
|------------|-------------|----------|--------|-------------------|-----------------|
| agency_clients | 768 | Cosine | 16 | 200 | id, plan, chat_id, created_at |
| agency_campaigns | 768 | Cosine | 16 | 200 | id, client_id, status, created_at |
| agency_brand_guides | 768 | Cosine | 16 | 200 | id, client_id, version |
| agency_conversations | 768 | Cosine | 16 | 200 | id, chat_id, client_id, session_id, created_at |
| agency_working_memory | 768 | Cosine | 16 | 200 | id, user_id, last_updated |
| agency_assets | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, type, tags |
| agency_tasks | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, status, assignee, priority |
| agency_video_metadata | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, asset_id |
| agency_knowledge | 768 | Cosine | 16 | 200 | id, type, tags, created_at |

---

## Mem0 Integration

Mem0 uses a separate collection for vector memory:

- **Collection:** `will`
- **Embedding Model:** `nomic-embed-text` via Ollama
- **Vector Size:** 768
- **Distance:** Cosine
- **TTL Policy:**
  - Conversations: 7 days
  - Important memories: 30 days

---

## Initialization

Run the initialization script to create all collections:

```bash
npx tsx scripts/init-qdrant-collections.ts --reset false
```

Use `--reset true` to delete and recreate all collections (WARNING: destroys all data).
