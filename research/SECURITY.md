# SECURITY AUDIT — SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Auditor:** Security Agent
**SPEC:** SPEC-092 (Trieve RAG Integration)
**Score:** 6.8/10 — APPROVED WITH MITIGATIONS

---

## EXECUTIVE SUMMARY

A integração de RAG via Trieve traz riscos de segurança inerentes a sistemas de retrieval. Os principais problemas são: **Ausência de API key validation**, **potential de chunk injection**, e **exposição de serviços internos via porta Docker**. Mitigações são straightforward e não bloqueiam o deployment.

---

## 1. FINDINGS (April 2026 Best Practices)

### 1.1 CRÍTICO — API Key Generation Without Canonical Storage

**Problema:** O SPEC menciona `TRIEVE_API_KEY=generated_on_first_login` sem definir onde será armazenado.

```bash
# O SPEC diz secrets.env mas isso viola ADR-001
Environment variables (secrets.env):
TRIEVE_API_KEY=generated_on_first_login
```

**Recomendações:**
```bash
# 1. Gerar a key ANTES do deploy
openssl rand -hex 32

# 2. Adicionar a .env (NÃO secrets.env)
TRIEVE_API_KEY=<generated-key>

# 3. Adicionar a .env.example com placeholder
TRIEVE_API_KEY=replace-with-openssl-rand-hex-32

# 4. Validar no startup (fail fast)
if (!process.env.TRIEVE_API_KEY) {
  throw new Error("TRIEVE_API_KEY missing in .env");
}
```

**Porque CRÍTICO:** API key sem storage canonical = key perdida no próximo restart.

---

### 1.2 ALTO — Qdrant Collection Collision Risk

**Problema:** SPEC-092 usa `QDRANT_COLLECTION=trieve` mas Mem0 (SPEC-074) usa `QDRANT_COLLECTION=will`. O SPEC menciona mitigação mas sem validação explícita.

```yaml
# SPEC-092 docker-compose
- QDRANT_COLLECTION=trieve

# SPEC-074 (Mem0)
# Usa collection "will"
```

**Recomendação:**
```bash
# Verificar collections existentes ANTES de criar
curl -s http://localhost:6333/collections | jq '.collections[].name'

# Collections devem ser SEPARADAS:
# - mem0: "will" (SPEC-074)
# - trieve: "trieve" (SPEC-092)
```

**Update necessário em SPEC-092:**
```yaml
environment:
  - QDRANT_COLLECTION=trieve  # ✅ SEPARADO de Mem0 ("will")
```

---

### 1.3 ALTO — Missing API Key Validation in Hermes Integration

**Problema:** O pseudo-code para `rag_retrieve` não valida a API key antes do request.

```python
# SPEC-092 pseudo-code — SEM validação
async def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    response = requests.post(
        f"{TRIEVE_URL}/api/v1/search",
        headers={"Authorization": f"Bearer {TRIEVE_API_KEY}"},
        json={"query": query, "limit": top_k}
    )
    return [r["chunk"]["content"] for r in response.json()["results"]]
```

**Recomendação (implementar antes de FASE 3):**
```python
# Hermes skill: rag_retrieve.py
import os
from typing import Optional

TRIEVE_API_KEY: Optional[str] = None
TRIEVE_URL: str = ""

def validate_config() -> None:
    global TRIEVE_API_KEY, TRIEVE_URL
    TRIEVE_API_KEY = os.getenv("TRIEVE_API_KEY")
    TRIEVE_URL = os.getenv("TRIEVE_URL", "http://localhost:6435")

    if not TRIEVE_API_KEY:
        raise RuntimeError("TRIEVE_API_KEY not set in .env")
    if not TRIEVE_URL:
        raise RuntimeError("TRIEVE_URL not set in .env")

async def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    validate_config()

    # Limitar top_k para evitar context overflow
    top_k = min(top_k, 5)

    response = requests.post(
        f"{TRIEVE_URL}/api/v1/search",
        headers={"Authorization": f"Bearer {TRIEVE_API_KEY}"},
        json={"query": query, "limit": top_k},
        timeout=10
    )
    response.raise_for_status()
    return [r["chunk"]["content"] for r in response.json()["results"]]
```

---

### 1.4 MÉDIO — Chunk Injection via Document Indexing

**Problema:** Indexar documentos do filesystem (`hermes-second-brain/docs/`, `monorepo/docs/SPECS/`) sem sanitização pode injetar chunks maliciosos.

**Cenário:** Um documento com conteúdo especialmente craftado pode injetar prompts no RAG que são retrievalados e injetados no LLM (RAG poisoning).

**Recomendação:**
```python
# Trieve chunk sanitization antes de indexar
import re

def sanitize_chunk(content: str, max_length: int = 10000) -> str:
    # Remover instruções de injection
    content = re.sub(r'<\|.*?\|>', '', content)  # Remove tag injection
    content = re.sub(r'\[INST\].*?\[/INST\]', '', content, flags=re.DOTALL)  # Remove prompt injection
    content = re.sub(r'System:.*?(?=\n\n|\nUser:|$)', '', content, flags=re.DOTALL)  # Remove system prompt injection

    # Truncar para evitar overflow
    return content[:max_length]
```

**Também:** Adicionar metadata de source para audit trail:
```python
{
  "content": sanitize_chunk(raw_content),
  "metadata": {
    "source": "hermes-second-brain",
    "type": "skill",
    "indexed_at": datetime.utcnow().isoformat(),
    "file_path": "/path/to/original/file.md"  # Para debugging
  }
}
```

---

### 1.5 MÉDIO — Docker Port Exposure (localhost:6435)

**Problema:** O docker-compose fragment mapeia `6435:3000` mas não há network isolation explícita.

```yaml
services:
  trieve:
    ports:
      - "6435:3000"  # ⚠️ Exposto no host
```

**Recomendação:**
```yaml
services:
  trieve:
    ports:
      - "127.0.0.1:6435:3000"  # ✅ Bind apenas em loopback
    networks:
      - homelab_internal  # ✅ Isolamento de rede

networks:
  homelab_internal:
    internal: true  # Sem acesso externo
```

**Porque:** Se Coolify expuser a porta publicamente, Trieve fica acessível sem autenticação (apesar da API key, defense in depth).

---

### 1.6 MÉDIO — No Rate Limiting on Trieve API

**Problema:** O SPEC não menciona rate limiting. Um atacante com API key pode fazer DDoS interno.

**Recomendação (adicionar a .env se Trieve suportar):**
```bash
# Rate limiting
TRIEVE_RATE_LIMIT=100  # requests per minute
TRIEVE_RATE_WINDOW=60  # seconds
```

**Alternativa via nginx/internal proxy:**
```nginx
# Rate limit no ingress
limit_req_zone $binary_remote_addr zone=trieve:10m rate=10r/s;
```

---

### 1.7 BAIXO — Ollama/Qdrant Over HTTP (No TLS)

**Problema:** Conexões para Ollama (:11434) e Qdrant (:6333) são HTTP, não HTTPS.

```yaml
environment:
  - QDRANT_URL=http://10.0.9.1:6333  # ⚠️ HTTP
  - OLLAMA_BASE_URL=http://10.0.9.1:11434  # ⚠️ HTTP
```

**Recomendação:** Manter HTTP apenas se localhost/internal network. Considerar TLS se Exposed externally.

**Contexto:** No teu setup, 10.0.9.1 é IP interno do host (Docker bridge). TLS overkill para internal, mas documentar que é intentional.

---

### 1.8 BAIXO — Missing Health Check Authentication

**Problema:** SPEC menciona `/health` endpoint mas não se Trieve suporta auth nele.

```bash
# SPEC acceptance criteria
- [ ] Trieve deployado em `:6435` e respondendo `/health`
```

**Recomendação:**
```bash
# Testar health endpoint
curl http://localhost:6435/health

# Se retorna 401/403 sem auth, é bom (defense in depth)
# Se retorna 200 sem auth, auditar o que expõe
```

---

## 2. MISSING SECURITY CONFIGURATIONS

### 2.1 Required .env Entries (ADR-001 Compliance)

```bash
# ==========================================
# Trieve RAG (SPEC-092)
# ==========================================
TRIEVE_API_KEY=<openssl rand -hex 32>
TRIEVE_URL=http://localhost:6435
TRIEVE_COLLECTION=trieve  # SEPARADO de Mem0 collection "will"

# Ollama (embedding - já existe em OLLAMA_URL)
# OLLAMA_URL=http://localhost:11434

# Qdrant (vector storage - já existe)
# QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=<já existe>
```

### 2.2 Startup Validation (Fail Fast)

```typescript
// apps/hermes-agency/src/rag/validate.ts
const REQUIRED_TRIEVE = ['TRIEVE_API_KEY', 'TRIEVE_URL'];

for (const key of REQUIRED_TRIEVE) {
  if (!process.env[key]) {
    console.error(`[RAG] FATAL: ${key} not set in .env`);
    process.exit(1);
  }
}

console.log('[RAG] Configuration validated');
```

### 2.3 PORTS.md Update Required

**File:** `/srv/ops/ai-governance/PORTS.md` (ou `docs/INFRASTRUCTURE/PORTS.md` se existir)

**Entry needed:**
```markdown
| :6435 | Trieve (RAG API) | localhost only | Internal RAG pipeline, no external access |
```

---

## 3. UPDATES FOR SPEC-092

### 3.1 Add Security Section

```markdown
## Security Considerations

### API Key Management
- `TRIEVE_API_KEY` gerado via `openssl rand -hex 32`
- Armazenado em `.env` (canonical source, ADR-001)
- Validado no startup (fail fast)

### Network Isolation
- Trieve bind: `127.0.0.1:6435` (loopback only)
- Docker network: `homelab_internal` (isolado)
- Sem exposição externa sem explicit approval

### Qdrant Collection Separation
- Trieve: `trieve` collection
- Mem0: `will` collection (SPEC-074)
- Collections SEPARADAS para isolar memory de knowledge

### Chunk Sanitization
- Docs indexados passam por sanitization (remove injection patterns)
- Metadata inclui source path para audit trail

### Rate Limiting
- TBD: Implementar rate limit no Trieve ou upstream proxy
```

### 3.2 Update docker-compose with Security Hardening

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "127.0.0.1:6435:3000"  # Loopback only
    environment:
      - QDRANT_URL=http://10.0.9.1:6333
      - QDRANT_COLLECTION=trieve
      - OLLAMA_BASE_URL=http://10.0.9.1:11434
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
      # API key via environment (set in .env, injected by Coolify)
    volumes:
      - /srv/data/trieve:/run/trieve
    restart: unless-stopped
    networks:
      - homelab_internal
    read_only: true  # Read-only filesystem
    security_opt:
      - no-new-privileges:true

networks:
  homelab_internal:
    internal: true
```

---

## 4. WHAT TO ADD/UDPATE/DELETE

### ADD

| Item | Razão |
|------|-------|
| `TRIEVE_API_KEY` em `.env` | Canonical secrets storage (ADR-001) |
| `TRIEVE_API_KEY` em `.env.example` | Documentação de placeholder |
| Startup validation em Hermes skill | Fail fast, não silent degradation |
| Chunk sanitization function | Prevenir RAG poisoning |
| PORTS.md entry para `:6435` | Port governance compliance |
| Security section em SPEC-092 | Documentar decisões de security |

### UPDATE

| Item | Mudança |
|------|---------|
| SPEC-092 docker-compose | Bind loopback + internal network + read-only |
| SPEC-092 acceptance criteria | Adicionar health check authentication |
| Hermes `rag_retrieve` skill | Adicionar API key validation + timeout |

### DELETE

| Item | Razão |
|------|-------|
| `secrets.env` reference | Viola ADR-001 (todos os secrets em `.env`) |
| `RERANK_MODEL` (FASE 1) | Out of scope para FASE 1, adiar para FASE 4 |

---

## 5. COMPLIANCE CHECKLIST

| Requirement | Status | Notes |
|-------------|--------|-------|
| `.env` as canonical source | ✅ Compliant | CRIAR `TRIEVE_API_KEY` |
| No hardcoded secrets | ✅ Compliant | API key via env |
| Fail-fast validation | ⚠️ Partial | Implementar na FASE 3 |
| Network isolation | ⚠️ Partial | Configurar antes do deploy |
| Port governance | ❌ Missing | Adicionar `:6435` a PORTS.md |
| Chunk sanitization | ❌ Missing | Implementar antes de indexar |
| Rate limiting | ❌ Missing | Adicionar em FASE 3/4 |

---

## 6. RISK SUMMARY

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API key loss (no canonical storage) | HIGH | HIGH | Add to `.env` before deploy |
| Qdrant collection collision | LOW | MEDIUM | Collections `trieve` vs `will` |
| RAG poisoning via docs | MEDIUM | MEDIUM | Chunk sanitization |
| Unauthenticated Trieve access | LOW | HIGH | Loopback bind + internal network |
| Internal DDoS via rate limiting | MEDIUM | MEDIUM | Add rate limit in FASE 3 |

---

## 7. VERDICT

**APPROVED WITH MITIGATIONS**

O SPEC-092 pode proceder para FASE 1 com as seguintes condições:

1. **ANTES do deploy:** Gerar `TRIEVE_API_KEY` e adicionar a `.env`
2. **ANTES do deploy:** Bind Trieve em `127.0.0.1:6435` (não `0.0.0.0`)
3. **FASE 3:** Implementar chunk sanitization antes de indexar
4. **FASE 3:** Adicionar startup validation em Hermes skill

**Blockers:** Nenhum blocker crítico identificado. Mitigações são straightforward.

---

## 8. REFERENCES

- [OWASP Top 10 for LLM Apps](https://owasp.org/www-project-top-10-for-llm-applications/)
- [Trieve Security Docs](https://docs.trieve.ai)
- ADR-001: `.env` as Canonical Secrets Source
- SPEC-059: Hermes Agency Datacenter Hardening
- SPEC-074: Hermes Second Brain com Mem0
