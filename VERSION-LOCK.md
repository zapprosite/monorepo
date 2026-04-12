# Version Lock — 2026-04-12

Critical tool versions pinned for homelab-monorepo.

| Tool | Version | Source |
|------|---------|--------|
| Turbo | 2.9.6 | CLAUDE.md / package.json |
| pnpm | 9.0.x | CLAUDE.md |
| Node.js | (check .nvmrc or package.json) | local |
| Claude Code CLI | 2.1.89 | research 2026-04-11 |
| Kokoro FastAPI | v0.2.2 | `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2` |

## Voice PT-BR — Kokoro TTS (IMUTÁVEL)

**⚠️ ATENÇÃO LLM:** As vozes Kokoro são governadas por rules. NUNCA altere sem aprovação.

| Voice ID | Tipo | Uso | Status | Notes |
|----------|------|-----|--------|-------|
| `pm_santa` | Masculino PT-BR | **PADRÃO** — uso principal em produção | ✅ | Canonical voice |
| `pf_dora` | Feminino PT-BR | Fallback / voz alternativa | ✅ | Canonical voice |
| Todas as outras | — | BLOQUEADAS | ❌ | TTS Bridge retorna HTTP 400 |

**Container:** `zappro-kokoro`
**TTS Bridge:** `zappro-tts-bridge` (:8013) — filtro de vozes Kokoro
**Kokoro direto:** `:8880` — **NUNCA usar diretamente** (sem filtro)
**Voices permitidas via TTS Bridge:** APENAS `pm_santa` e `pf_dora`

## Update Policy

AI agents CANNOT update pinned components without:
1. Research via Context7/Tavily
2. Explicit approval from will-zappro
3. Version bump in this file + git commit

## Verification

```bash
pnpm --version  # should be 9.x
turbo --version  # should be 2.9.6
```
