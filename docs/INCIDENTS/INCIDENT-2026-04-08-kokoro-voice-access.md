# INCIDENT-2026-04-08: Kokoro Voice Access Control

**Data:** 2026-04-08
**Severidade:** 🟡 MEDIUM (preventivo)
**Tipo:** Voice Pipeline / Access Control
**Status:** ✅ RESOLVIDO

---

## Sumário

O Hermes Agent Bot tinha acesso a 67 vozes no Kokoro TTS, incluindo vozes não-PT-BR e vozes artificiais. O utilizador queria restringir a duas vozes PT-BR naturais: **pm_santa** (masculina) e **pf_dora** (feminina).

---

## Solução Implementada: TTS Bridge

**Ficheiros criados:**
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py` — proxy Python stdlib
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge-docker-compose.yml` — deploy
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.md` — documentação

**Ficheiros modificados:**
- `/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md` — TTS Bridge adicionado
- `/srv/monorepo/docs/GOVERNANCE/HERMES_AGENT_DEBUG.md` — arquitectura atualizada
- `/srv/monorepo/docs/OPERATIONS/SKILLS/README.md` — índice atualizado

---

## Arquitetura

```
Hermes Agent Bot
    │
    └─► TTS Bridge (:8013) — validado 2026-04-08
            ├─ pm_santa ✓ → Kokoro :8880 → audio
            └─ pf_dora ✓ → Kokoro :8880 → audio
                 [OUTRAS] ✗ → 400 Bad Request
```

**Container:** `zappro-tts-bridge`
**Redes:** `qgtzrmi6771lt8l7x8rqx72f` + `zappro-lite_default`
**IP:** `10.0.19.5` (qgtzrmi) / `10.0.2.6` (zappro-lite)

---

## Verificação

```bash
# Voz permitida → 200
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"teste","voice":"pm_santa"}' -w "HTTP %{http_code}\n"
# HTTP 200

# Voz bloqueada → 400
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"teste","voice":"af_sarah"}' -w "HTTP %{http_code}\n"
# HTTP 400
```

**Smoke test:** 15/15 PASS ✅

---

## Lessons Learned

1. **Kokoro não tem filtro nativo de vozes** — todas as 67 vozes estavam acessíveis
2. **LiteLLM não consegue rotear para o TTS Bridge** (timeout persistente) — rota direta Hermes Agent → Bridge funciona
3. **Solução stdlib** — TTS Bridge usa apenas Python stdlib, sem deps externas

---

## Prevenção

O TTS Bridge está registrado em `PINNED-SERVICES.md` como serviço PINNED. Qualquer LLM que proponha mudanças deve verificar este documento primeiro.

---

**Registrado:** 2026-04-08
**Autor:** will + Claude Code
**Revisão:** semanal (2026-04-15)