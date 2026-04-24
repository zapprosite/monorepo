# Version Lock — 2026-04-12

Critical tool versions pinned for homelab-monorepo.

| Tool            | Version                        | Source                                     |
| --------------- | ------------------------------ | ------------------------------------------ |
| Turbo           | 2.9.6                          | CLAUDE.md / package.json                   |
| pnpm            | 9.0.x                          | CLAUDE.md                                  |
| Node.js         | (check .nvmrc or package.json) | local                                      |
| Claude Code CLI | 2.1.89                         | research 2026-04-11                        |
| TypeScript      | ^5.7.3                         | apps/\*/package.json                       |
| Biome           | ^2.3.0                         | apps/ai-gateway/package.json               |
| Kokoro FastAPI  | v0.2.2                         | `ghcr.io/remsky/-fastapi-gpu:v0.2.2` |

## Voice PT-BR — Kokoro TTS (IMUTÁVEL)

**⚠️ ATENÇÃO LLM:** As vozes Kokoro são governadas por rules. NUNCA altere sem aprovação.

| Voice ID        | Tipo            | Uso                                    | Status | Notes                       |
| --------------- | --------------- | -------------------------------------- | ------ | --------------------------- |
| `pm_santa`      | Masculino PT-BR | **PADRÃO** — uso principal em produção | ✅     | Canonical voice             |
| `pf_dora`       | Feminino PT-BR  | Fallback / voz alternativa             | ✅     | Canonical voice             |
| Todas as outras | —               | BLOQUEADAS                             | ❌     | TTS Bridge retorna HTTP 400 |

**Container:** `zappro-`
**TTS Bridge:** `zappro-tts-bridge` (:8013) — filtro de vozes Kokoro
**Kokoro direto:** `:8880` — **NUNCA usar diretamente** (sem filtro)
**Voices permitidas via TTS Bridge:** APENAS `pm_santa` e `pf_dora`

## Voice Pipeline Desktop — Ctrl+Shift+C

| Component          | Value                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| **Shortcut**       | `Ctrl+Shift+C` (GNOME custom keybinding)                                    |
| **Script**         | `/home/will/Desktop/voice-pipeline/scripts/speak.sh`                        |
| **Voice**          | `pf_dora` (feminino PT-BR)                                                  |
| **Endpoint**       | TTS Bridge `:8013`                                                          |
| **Flow**           | xclip (primary selection) → LLM humanização → TTS Bridge → Kokoro → pw-play |
| **Debounce**       | 3 segundos entre ativações                                                  |
| **Hotkey install** | `hotkey-speak.sh`                                                           |
| **Hotkey remove**  | `hotkey-unspeak.sh`                                                         |

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
