# Estado do Sistema — homelab

**Atualizado:** 2026-04-06
**Host:** homelab
**SO:** Ubuntu 24.04.4 LTS (Noble Numbat) — Desktop, Xorg/GNOME
**Kernel:** 6.17.0-20-generic
**Status geral:** ✅ Operacional (20 containers ativos)

---

## Hardware

| Componente        | Especificação                                              |
| ----------------- | ---------------------------------------------------------- |
| **CPU**           | AMD Ryzen 9 7900X — 12 núcleos / 24 threads                |
| **RAM**           | 32 GB DDR5                                                 |
| **GPU**           | NVIDIA RTX 4090 — 24 GB VRAM, Driver 580.126.20, CUDA 13.0 |
| **Disco sistema** | nvme1n1 — Kingston SNV3S1000G 931 GB (ext4)                |
| **Disco dados**   | nvme0n1 — Crucial CT4000T700SSD3 3,64 TB (ZFS pool "tank") |

### GPU — VRAM Atual

```
Total:   24.564 MiB
Usado:   ~8.000 MiB  (desktop + kokoro/whisper sob demanda)
Livre:   ~16.000 MiB
```

| Processo                         | VRAM         |
| -------------------------------- | ------------ |
| Xorg + GNOME (fixo)              | ~1 GB        |
| Whisper API (sob demanda)        | ~4 GB        |
| Kokoro TTS (sob demanda)         | ~1,5 GB      |
| Qwen 3.5 (sob demanda, Ollama)   | ~6,5 GB      |
| BGE-M3 F16 (sob demanda, Ollama) | ~1,2 GB      |
| **Pior caso com tudo carregado** | **~14,2 GB** |

### Otimizações de Kernel Aplicadas

| Parâmetro                   | Valor  | Motivo                  |
| --------------------------- | ------ | ----------------------- |
| vm.swappiness               | 5      | Evitar swap em host GPU |
| vm.dirty_ratio              | 15     | Responsividade I/O      |
| I/O scheduler               | none   | NVMe sem fila           |
| TCP buffers                 | 128 MB | Throughput máximo       |
| fs.inotify.max_user_watches | 524k   | webpack/nodemon         |

---

## Armazenamento

### Sistema (nvme1n1)

| Partição  | Mount     | Tamanho | Uso                     |
| --------- | --------- | ------- | ----------------------- |
| nvme1n1p1 | /boot/efi | 1 GB    | FAT32, EFI              |
| nvme1n1p2 | /         | 279 GB  | ext4, SO — 41 GB usados |
| nvme1n1p3 | /home     | 651 GB  | ext4, usuário           |

### Dados — ZFS Pool "tank" (nvme0n1)

| Dataset          | Mount              | Usado        | Função                 |
| ---------------- | ------------------ | ------------ | ---------------------- |
| tank/docker-data | /srv/docker-data   | 22,1 GB      | Runtime Docker         |
| tank/monorepo    | /srv/monorepo      | 195 MB       | Código aplicação       |
| tank/backups     | /srv/backups       | 194 MB       | Arquivos backup        |
| tank/models      | /srv/models        | 38 KB        | Modelos IA (crescendo) |
| tank/n8n         | /srv/data/n8n      | 10 MB        | Workflows n8n          |
| tank/qdrant      | /srv/data/qdrant   | 257 KB       | Vetores Qdrant         |
| tank/postgres    | /srv/data/postgres | 24 KB        | DB n8n                 |
| tank/caprover    | /srv/data/caprover | 25 KB        | Dados CapRover         |
| tank/supabase    | /tank/supabase     | 24 KB        | Supabase config        |
| tank/supabase-db | /tank/supabase-db  | 24 KB        | Supabase PostgreSQL    |
| **Total**        |                    | **~22,5 GB** | **de 3,49 TB livre**   |

---

## Containers Docker (20 ativos)

### Stack Plataforma — /srv/apps/platform/

| Container    | Porta      | Status     |
| ------------ | ---------- | ---------- |
| qdrant       | 6333, 6334 | ✅ healthy |
| n8n          | 5678       | ✅ healthy |
| n8n-postgres | interna    | ✅ healthy |

### Stack CapRover — /srv/apps/caprover/

| Container       | Porta   | Status     |
| --------------- | ------- | ---------- |
| captain-nginx   | 80, 443 | ✅ running |
| captain-captain | 3000    | ✅ running |
| captain-certbot | interna | ✅ running |

### Stack Voice — Kokoro + Whisper API

| Container         | Porta host | Status     |
| ----------------- | ---------- | ---------- |
| kokoro (TTS)      | 8012       | ✅ healthy |
| whisper-api (STT) | 8201       | ✅ healthy |

### Stack LiteLLM — /srv/apps/litellm/

| Container  | Porta          | Status     |
| ---------- | -------------- | ---------- |
| litellm    | 4000 (host)    | ✅ healthy |
| litellm-db | 127.0.0.1:5440 | ✅ healthy |

### Dev

| Container         | Porta | Status     |
| ----------------- | ----- | ---------- |
| connected_repo_db | 5432  | ✅ running |

---

## LiteLLM — LLM Gateway (Docker, network_mode: host)

**Endpoint local:** http://localhost:4000/v1
**Endpoint público:** https://llm.zappro.site/v1
**UI admin:** http://localhost:4000/ui
**Auth:** `Authorization: Bearer <key>`
**Deploy:** 2026-03-18

| Alias                    | Backend           | Uso                         |
| ------------------------ | ----------------- | --------------------------- |
| `gpt-4o`                 | ollama/qwen3.5    | Completion (alias OpenAI)   |
| `qwen3.5`                | ollama/qwen3.5    | Completion (thinking model) |
| `gemma4`                 | ollama/gemma4     | Completion (instruction)    |
| `text-embedding-ada-002` | ollama/bge-m3     | Embeddings (alias OpenAI)   |
| `bge-m3`                 | ollama/bge-m3     | Embeddings 1024 dims        |
| `qwen2.5-vl`             | ollama/qwen2.5-vl | Vision (multi-modal)        |

---

## Ollama — LLM Local (systemd)

**Endpoint:** http://localhost:11434 (acessível via LiteLLM publicamente)
**Gerenciamento:** descarga automática após ~5 min idle

| Modelo                  | Params | Quant  | VRAM    | Contexto           | Capacidades                                |
| ----------------------- | ------ | ------ | ------- | ------------------ | ------------------------------------------ |
| qwen3.5:latest          | 9,65B  | Q4_K_M | ~6,5 GB | **262.144 tokens** | completion · vision · tools · **thinking** |
| gemma4:latest           | 12B    | Q4_K_M | ~7 GB   | **32.768 tokens**  | completion · instruction                   |
| qwen2.5-vl:latest       | 7B     | Q4_K_M | ~4,5 GB | 8.192 tokens       | vision · completion                        |
| nomic-embed-text:latest | 274M   | F16    | ~0,5 GB | 8.192 tokens       | embedding (1024 dims)                      |
| bge-m3:latest           | 566,7M | F16    | ~1,2 GB | 8.192 tokens       | embedding (1024 dims)                      |

---

## GPU — Configuração CDI

O acesso GPU dos containers usa **CDI (Container Device Interface)** — sem necessidade de reiniciar o Docker daemon:

```bash
# Spec gerada em:
/etc/cdi/nvidia.yaml   # nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml

# Uso no docker-compose:
devices:
  - nvidia.com/gpu=0
```

---

## Ambiente Desktop

- **Display:** Xorg (não Wayland)
- **DE:** GNOME Shell
- **Browser:** Chrome 146 (GPU accelerated, 15+ performance flags)
- **Shell:** bash

---

## Checklist de Saúde

```bash
# Containers ativos
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v "Up.*healthy" | grep -v "Up.*running"

# VRAM
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader

# Modelos Ollama carregados agora
curl -s http://localhost:11434/api/ps | python3 -m json.tool

# ZFS
zpool status tank && zfs list

# Voice stack — Kokoro + Whisper
curl -s http://localhost:8012/health   # Kokoro TTS
curl -s http://localhost:8201/health   # Whisper API

# LiteLLM
curl -s http://localhost:4000/health
```

---

**Próxima revisão:** ao adicionar serviços ou mudar hardware
