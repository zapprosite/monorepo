# SPEC-202 — Hermes Second Brain: Mem0 API Production Deploy

**Author:** Nexus SRE
**Date:** 2026-05-01
**Status:** em-execucao
**Stack:** Mem0 + Qdrant + FastAPI + Ollama (hermes-second-brain)

---

## Problema

Hermes Second Brain Mem0 API em `:6334` **não está rodando**. O código existe em `/srv/hermes-second-brain/` (FastAPI + Mem0 + Qdrant), mas sem venv e sem systemd unit. Resultado: todo `memory.write/read` via Hermes falha — só resta fallback arquivo.

**Contexto — duas camadas de memory no homelab:**
- **Trieve** (`:8090`) — RAG server, busca de documentos, usa Qdrant + Postgres + Redis
- **Mem0** (`:6334`) — memória dinâmica de agentes (preferências, session state, facts), conecta direto no Qdrant

**Elas não competem — são complementares.**

---

## Arquitetura

```
Agente (vibe-kit worker)
    │
    ├── POST /memory {"text": "..."}   →  Hermes (:6334) → Mem0 → Qdrant (:6333)
    ├── GET  /memory/query             →  Hermes (:6334) → Mem0 → Qdrant (:6333)
    │
    └── Trieve (:8090)                 →  RAG documentos (separado, não compete)
```

### Coleções Qdrant existentes

| Collection | Uso | Tamanho |
|---|---|---|
| `will` | Mem0 agent memory | pequeno |
| `agency_*` | Hermes agency | pequeno |
| `second-brain` | RAG docs (Trieve) | médio |

Mem0 conecta na collection `will`. Não conflita.

---

## Etapas

### 1. Criar venv + instalar deps

```bash
cd /srv/hermes-second-brain
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

Dependências (`pyproject.toml`): `mem0ai`, `qdrant-client`, `fastapi`, `uvicorn`, `ollama`.

### 2. Variáveis de ambiente

Criar `/srv/hermes-second-brain/.env` (gitignored):

```bash
MEM0_QDRANT_URL=http://localhost:6333
MEM0_QDRANT_COLLECTION=will
MEM0_OLLAMA_URL=http://localhost:11434
MEM0_OLLAMA_MODEL=nomic-embed-text:latest
QDRANT_API_KEY=<from /srv/monorepo/.env>
```

### 3. Systemd unit

**Arquivo:** `/etc/systemd/system/hermes-second-brain.service`

```ini
[Unit]
Description=Hermes Second Brain — Mem0 + Qdrant API
After=network.target docker-compose.service
Wants=zappro-qdrant.service

[Service]
Type=simple
User=will
WorkingDirectory=/srv/hermes-second-brain
ExecStart=/srv/hermes-second-brain/venv/bin/uvicorn apps.api.main:app --host 127.0.0.1 --port 6337 --workers 1
Restart=on-failure
RestartSec=10
EnvironmentFile=/srv/hermes-second-brain/.env
Environment=PYTHONPATH=/srv/hermes-second-brain
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hermes-second-brain
sudo systemctl start hermes-second-brain
```

### 4. Verificação

```bash
curl -s http://127.0.0.1:6337/health
# Esperado: {"status":"ok","service":"hermes-second-brain"}

curl -s -X POST http://127.0.0.1:6337/memory/ \
  -H "Content-Type: application/json" \
  -d '{"text":"test SPEC-202","source":"test"}'

curl -s -X POST http://127.0.0.1:6337/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query":"SPEC-202","limit":3}'
```

### 5. Wire no vibe-kit (run-vibe.sh)

O `run-vibe.sh` atual usa `HERMES_URL=:8642` (gateway). Adicionar:

```bash
HERMES_MEM0_URL="${HERMES_MEM0_URL:-http://127.0.0.1:6337}"
```

Adaptar `_hermes_write_memory()` para chamar `:6334`:

```bash
_hermes_write_memory() {
    local content="$1"
    local tags="${2:-vibe-kit}"
    curl -s -X POST "http://127.0.0.1:6334/memory/" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$content\",\"source\":\"vibe-kit\",\"tags\":[\"$tags\"]}" || true
}
```

### 6. Camadas de memory — clarifying

| Camada | Tecnologia | Porta | Uso |
|--------|------------|-------|-----|
| Agent memory dinâmico | Mem0 | `:6334` | Preferences, session facts |
| Document RAG | Trieve | `:8090` | Buscar docs, SPECs |
| Vector store | Qdrant | `:6333` | both use |
| Session cache | Redis | `:6379` | Rate limiting, cache |

Trieve (docker compose) continua sem mudança.

---

## Task List

- [x] Criar venv em `/srv/hermes-second-brain/venv`
- [x] `pip install -e .` + `pip install ollama` (ollama lib requerida por Mem0)
- [x] Criar `.env` com QDRANT_API_KEY e vars
- [x] Criar systemd unit `/etc/systemd/system/hermes-second-brain.service`
- [x] Fix `Restart=unless-stopped` → `Restart=on-failure` (unless-stopped inválido no systemd)
- [x] `systemctl enable --now hermes-second-brain`
- [x] Verificar `/health` → `{"status":"ok"}` ✅ (porta 6337 — :6334 ocupada por Qdrant GRPC)
- [x] Testar write + query memory ✅ (Qdrant 2015 pontos, save+search funcionais)
- [ ] Atualizar `run-vibe.sh` com `HERMES_MEM0_URL=http://127.0.0.1:6337`
- [ ] Adaptar `_hermes_write_memory()` para `:6337`
- [ ] Atualizar PORTS.md com Mem0 :6337
- [ ] SPEC-202 status → `concluido`

## Issues resolvidos durante deploy

| Issue | Solução |
|-------|---------|
| `Restart=unless-stopped` inválido | `Restart=on-failure` |
| `ollama` lib não instalada | `pip install ollama` |
| Porta `:6334` conflito (Qdrant GRPC) | Mem0 usa `:6337` |
| Pydantic deprecation warning | Non-breaking,已知 issue em mem0ai |
| spaCy not installed | Non-breaking, só usa se disponível |

---

## References

- `SPEC-3LAYER-MEMORY.md` — 3-layer memory architecture
- `ADR-20260424` — Mem0 decision record
- `/srv/hermes-second-brain/apps/api/router_memory.py` — endpoints
- `/srv/hermes-second-brain/libs/memory/manager.py` — Mem0 + Qdrant integration
- `docker-compose.trieve.yml` — Trieve RAG stack (separado)
