# Ollama Models Audit

**Data:** 2026-04-29
**Host:** will-zappro (localhost)
**GPU:** RTX 4090 (24 GB VRAM) | Driver: NVIDIA 580.126.20

---

## Models Inventory — Localhost (Ollama :11434)

| Name | ID | Size | Modified |
|------|-----|------|----------|
| `qwen2.5vl:3b` | fb90415cde1e | 3.2 GB | 3 days ago |
| `qwen2.5:3b` | 357c53fb659c | 1.9 GB | 3 days ago |
| `nomic-embed-text:latest` | 0a109f422b47 | 274 MB | 3 weeks ago |

**Total storage:** ~5.4 GB

---

## VRAM Usage

| Model | VRAM | Status |
|-------|------|--------|
| `qwen2.5vl:3b` | ~3.2 GB | Loaded (runner active) |
| `qwen2.5:3b` | ~1.9 GB | Not currently loaded |
| `nomic-embed-text` | ~274 MB | Not currently loaded |

**Estimated VRAM in use:** ~3.2 GB (only VL model active)

---

## srv Host (GPU Server) — NOT ACCESSIBLE

**Hostname:** `srv` — unresolvable from current context
**Expected IP:** 192.168.x.x (from NETWORK_MAP.md)
**GPU:** RTX 4090 — Ollama via systemd on `:11434`
**Status:** Cannot connect — requires VPN or correct IP

---

## Image Analysis (from audit screenshot)

> **Source:** `ollama-models-2026-04.jpeg`

Screenshot shows a chat about Daikin VRV AC system (U4-01, 43 internal units, suspected 5 bad VEEs). Relevant for context: HVAC diagnostic workflow with multi-step logical approach.

---

## Actions Required

- [ ] **srv accessibility:** Need VPN or correct IP to audit remote Ollama instance
- [ ] **qwen2.5vl:3b:** 3 days old — consider `ollama pull` to update if newer version available
- [ ] **nomic-embed-text:** 3 weeks old — check if update needed

---

## Related Docs

- `/srv/ops/ai-governance/NETWORK_MAP.md` — full network topology
- `/srv/monorepo/docs/OPERATIONS/SERVICE_MAP.md` — container inventory
- `/srv/ops/ai-governance/PORTS.md` — port allocations