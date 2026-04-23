# Trieve API v1 - Research Report

## Overview

Trieve is an API for building search and RAG (Retrieval-Augmented Generation) experiences. **Note:** Trieve Cloud was sunset as of November 1st, 2025; self-hosting is now required.

- **API Spec:** OpenAPI available at `https://beta-api.trieve.ai/api-docs/openapi.json`
- **TypeScript SDK:** https://ts-sdk.trieve.ai
- **Documentation:** https://docs.trieve.ai
- **Self-Hosting:** Docker Compose, AWS, Azure, GCP

---

## 1. Authentication

### Methods

| Method | Description |
|--------|-------------|
| **API Key** | Passed via `Authorization` header. Used for admin/owner endpoints. |
| **OAuth** | Email/password, SSO, Google, Github via OpenID Connect |
| **Cookie-based sessions** | For authenticated web users |

### API Key Usage

```http
Authorization: Bearer <api_key>
```

Or using API key directly:
```http
Authorization: ApiKey <api_key>
```

### Role Requirements

Most endpoints require the authenticated user or API key to have **admin (1)** or **owner (2)** role for the dataset's organization.

### Endpoints

- `POST /api/auth/login` - OAuth redirect for email/SSO/Google/Github
- `POST /api/auth/logout` - Invalidate cookie session (does not invalidate API key)
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/create_api_only_user` - Create API-only user

---

## 2. Search Endpoints

### Primary Search

**`POST /api/chunk/search`**

Search for chunks by semantic similarity, full-text similarity, or hybrid combination.

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (text, image URL, or audio base64) |
| `search_type` | enum | Yes | `semantic`, `fulltext`, `hybrid`, `bm25` |
| `page` | integer | No | Page number (1-indexed) |
| `page_size` | integer | No | Number of chunks to fetch |
| `filters` | ChunkFilter | No | Filter by metadata (`must`, `must_not`, `should`) |
| `score_threshold` | float | No | Minimum score/distance threshold |
| `highlight_options` | object | No | Customize highlighting behavior |
| `scoring_options` | object | No | Modify sparse/dense vectors for boosted scoring |
| `sort_options` | object | No | Sort by recency, location, MMR, or field |
| `slim_chunks` | boolean | No | Exclude content/chunk_html to reduce latency |
| `content_only` | boolean | No | Return only chunk_html |
| `typo_options` | object | No | Configure typo correction |

#### Response

```json
{
  "id": "uuid",
  "chunks": [{ "chunk": {...}, "score": 0.95, "highlights": [...] }],
  "total_pages": 10,
  "corrected_query": "original query"
}
```

#### Search Modes

- **semantic** - Embedding vectors for similarity search
- **fulltext** - SPLADE for keyword matching
- **hybrid** - Combines semantic and full-text with re-ranking
- **bm25** - Traditional BM25 keyword ranking

#### Headers Required

```http
Authorization: Bearer <api_key>
TR-Dataset: <dataset_id_or_tracking_id>
```

### Autocomplete

**`POST /api/chunk/autocomplete`**

Primary autocomplete functionality, prioritizing prefix matching with semantic or full-text search.

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Text, image URL, or audio base64 |
| `search_type` | enum | Yes | `fulltext`, `semantic`, `hybrid`, `bm25` |
| `page_size` | integer | No | Number of results |
| `slim_chunks` | boolean | No | Exclude content for reduced latency |
| `filters` | ChunkFilter | No | Filter by metadata |
| `score_threshold` | float | No | Minimum score threshold |
| `extend_results` | boolean | No | Include non-exact prefix matches |
| `user_id` | string | No | Track user interactions |

### Search Within Group

**`POST /api/chunk/group/search_within_group`**

Search only within a specific group. Useful for scoped searches.

### Search Over Groups

**`POST /api/chunk/group/search_over_groups`**

Get groups as results (not chunks), with matching chunks sorted by similarity within each group.

---

## 3. Chunk Upload

### Create/Upsert Chunk(s)

**`POST /api/chunk`**

Create new chunk(s) or upsert by `tracking_id`.

#### Bulk Upload Limit

- **Maximum 120 chunks per request**
- 413 error if exceeded
- 426 error if upgrade required for more chunks

#### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `chunk_html` | string | HTML or plaintext content |
| `tracking_id` | string | External identifier (upsert by this if `upsert_by_tracking_id: true`) |
| `upsert_by_tracking_id` | boolean | Update existing chunk if true |
| `group_ids` / `group_tracking_ids` | array | Groups to place the chunk in |
| `metadata` | object | JSON object for filtering |
| `tag_set` | array | List of tags for filtering |
| `num_value` | float | Numeric value for filtering |
| `weight` | float | Bias search relevance score |
| `link` | string | Source URL |
| `image_urls` | array | Associated image URLs |
| `location` | object | Geo coordinates `{lat, lon}` |
| `semantic_content` | string | Override text for embeddings |
| `fulltext_content` | string | Override text for fulltext/BM25 |
| `high_priority` | boolean | Priority queue (Custom Pro plans only) |
| `time_stamp` | string | ISO 8601 datetime |
| `convert_html_to_text` | boolean | Convert HTML to raw text |
| `split_avg` | boolean | Split text and average vectors |

### Update Chunk

**`PUT /api/chunk/{chunk_id}`**

Update existing chunk by ID.

**`PUT /api/chunk/tracking/{tracking_id}`**

Update chunk by tracking_id.

### Delete Chunk

**`DELETE /api/chunk/{chunk_id}`**

Delete chunk by ID.

**`DELETE /api/chunk/tracking/{tracking_id}`**

Delete chunk by tracking_id.

### Scroll Chunks

**`POST /api/chunk/scroll`**

Get paginated chunks with filters and custom sorting.

---

## 4. Dataset Management

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/dataset` | Create dataset |
| `GET` | `/api/dataset` | Get datasets from organization |
| `GET` | `/api/dataset/{id}` | Get dataset by ID |
| `GET` | `/api/dataset/tracking/{tracking_id}` | Get dataset by tracking ID |
| `PUT` | `/api/dataset` | Update dataset |
| `DELETE` | `/api/dataset/{id}` | Delete dataset |
| `DELETE` | `/api/dataset/tracking/{tracking_id}` | Delete by tracking ID |
| `POST` | `/api/dataset/batch` | Batch create datasets |
| `POST` | `/api/dataset/clone` | Clone dataset |
| `POST` | `/api/dataset/clear` | Clear all chunks/files/groups |
| `POST` | `/api/dataset/etl` | Create ETL job |
| `GET` | `/api/dataset/tags` | Get all tags |
| `GET` | `/api/dataset/{id}/usage` | Get usage metrics |
| `GET` | `/api/dataset/{id}/crawl-options` | Get crawl options |
| `POST` | `/api/dataset/{id}/pagefind` | Create Pagefind index |

### Create Dataset

**`POST /api/dataset`**

#### Required Headers

```http
TR-Organization: <organization_uuid>
```

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset_name` | string | Yes | Name for the dataset |
| `tracking_id` | string | No | External tracking ID (unique within org) |
| `server_configuration` | object | No | Embeddings, LLM, BM25, RAG settings |

### Batch Create

**`POST /api/dataset/batch`**

Create multiple datasets at once. Must be owner of organization.

---

## 5. File Upload

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/file` | Upload file to S3 (CSV, JSONL, HTML, etc.) |
| `GET` | `/api/file/{id}` | Get file with signed S3 URL |
| `DELETE` | `/api/file/{id}` | Delete file |
| `POST` | `/api/file/presigned` | Create presigned URL for large CSV/JSONL |
| `POST` | `/api/file/upload-html` | Upload and chunk HTML page |

### File Upload

- Max file size: **1GB**
- Supported: CSV, JSONL, HTML, general files
- Chunking strategy: Apache Tika text extraction OR vision LLM to markdown

---

## 6. Organization & API Keys

### Create API Key

**`POST /api/organization/api_key`**

Returns the API key value (only shown once at creation).

### Organization Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/organization` | Create organization |
| `GET` | `/api/organization/{id}` | Get organization |
| `PUT` | `/api/organization/{id}` | Update organization |
| `GET` | `/api/organization/{id}/api_keys` | List API keys (no values returned) |
| `DELETE` | `/api/organization/{id}/api_key/{key_id}` | Delete API key |

---

## 7. Quick Reference

### Required Headers

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <api_key>` or `ApiKey <api_key>` |
| `TR-Dataset` | Dataset UUID or tracking_id |
| `TR-Organization` | Organization UUID (for dataset creation) |
| `X-API-Version` | API version (optional, defaults based on org creation date) |

### Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient role) |
| 413 | Payload too large (bulk upload > 120 chunks) |
| 426 | Upgrade required |
| 424 | Model not available (for embedding/reranker endpoints) |

---

## Sources

- [Trieve Documentation](https://docs.trieve.ai)
- [OpenAPI Spec](https://beta-api.trieve.ai/api-docs/openapi.json)
- [TypeScript SDK](https://ts-sdk.trieve.ai)
- [GitHub](https://github.com/devflowinc/trieve)
