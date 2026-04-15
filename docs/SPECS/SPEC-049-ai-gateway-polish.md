---
name: SPEC-049-ai-gateway-polish
description: Corrigir 6 issues no ai-gateway: schema TTS voices, audio-speech voice remap, smoke test PT-BR, Coolify deploy, systemd, STT proxy consistency. Cruzado com PORTS.md + SUBDOMAINS.md.
status: PROPOSED
priority: critical
author: Principal Engineer
date: 2026-04-15
specRef: SPEC-009, SPEC-047, SPEC-048, PORTS.md, SUBDOMAINS.md
---

# SPEC-049: AI Gateway Polish — 6 Issues + SPEC Cross-Check

> ⚠️ **SPEC-009 Audio Stack imutável** — STT wav2vec2 :8202 (canonical). TTS Bridge :8013 (vozes `pm_santa`/`pf_dora`). NUNCA trocar.
> ⚠️ **Secrets** — `.env` é fonte canónica ÚNICA. Infisical foi PRUNED. Proibido hardcode.

---

## 1. Context

auditoria completa do ai-gateway (SPEC-048 checkpoint 2026-04-15) revelou 6 issues:

1. **TTS_ALLOWED_VOICES** — inclui vozes OpenAI (alloy, echo, fable...) que Kokoro não suporta
2. **audio-speech voice remap** — Zod aceita qualquer voice mas o código remapeia silenciosamente
3. **Smoke test falha em qualidade PT-BR** — smoke actual só testa HTTP codes, não qualidade
4. **Coolify ai-gateway exited** — mas processo nativo :4002 OK
5. **Sem systemd unit** — sem arranque automático no boot
6. **:8203 proxy não referenciado** — antigo STT_PROXY_URL, agora só STT_DIRECT_URL

---

## 2. Issues Detalhadas

### Issue 1: TTS_ALLOWED_VOICES inclui vozes OpenAI inválidas

**Ficheiro:** `apps/ai-gateway/src/schemas.ts:65-74`

**Problema:** `TTS_ALLOWED_VOICES` inclui `['pm_santa', 'pf_dora', 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']`. Kokoro só suporta `pm_santa` e `pf_dora` (SPEC-009). As outras vozes são OpenAI TTS — não Kokoro.

**Impacto:** Se cliente enviar `voice: 'alloy'`, Zod aceita mas audio-speech.ts remapeia para `pm_santa` silenciosamente.用户体验混乱.

**Fix:** Remover vozes OpenAI de `TTS_ALLOWED_VOICES`, keeping only `pm_santa` e `pf_dora`. Documentar que Kokoro só suporta estas duas vozes PT-BR.

---

### Issue 2: audio-speech.ts — voice remapping implícito sem validação

**Ficheiro:** `apps/ai-gateway/src/routes/audio-speech.ts:34-36`

**Problema:** O schema aceita qualquer voice (devido ao problema 1), e o código decide qual usar com base num mapa `MODEL_VOICE_MAP`. Mas se o cliente enviar `voice: 'alloy'` (não é pm_santa/pf_dora), o código verifica `(['pm_santa', 'pf_dora'] as string[]).includes(voice)` e se não for, usa `MODEL_VOICE_MAP[model]` (tts-1 → pm_santa, tts-1-hd → pf_dora). O problema é que se o cliente enviar uma voz inválida qualquer (ex: 'voiceXYZ'), o código simplesmente ignora e usa o default do model map. Não há warning nem erro.

**Fix:** Adicionar validação no route: se voice não é pm_santa/pf_dora E não é uma voz OpenAI conhecida, retornar 400 com erro claro.

---

### Issue 3: Smoke test não valida qualidade PT-BR

**Ficheiro:** `smoke-tests/smoke-multimodal-stack.sh`

**Problema:** O smoke test actual só verifica HTTP codes (200/400/500 = routing OK). Não testa:

- STT transcription accuracy em PT-BR
- TTS voice quality em PT-BR
- PT-BR filter effectiveness
- Vision description em PT-BR

**Fix:** Criar `smoke-tests/smoke-ai-gateway-quality.sh` que testa conteúdo real:

- STT: texto PT-BR conhecido → transcrição → comparação
- TTS: output bytes > 10KB (indica síntese real)
- Vision: descrição contém palavras PT-BR
- PT-BR filter: resposta EN → resposta PT-BR verificada

---

### Issue 4: Coolify ai-gateway — exited mas nativo OK

**Problema:** Coolify mostra ai-gateway (UUID `jo53d99erynvllgmga2s4h7o`) como `exited`, mas o processo nativo está a correr em :4002 (nohup tsx src/index.ts).

**Causa:** O deploy Coolify foi criado mas o container não está a arrancar correctamente. O serviço está a correr fora do Coolify por causa do `nohup`.

**Fix:** Verificar logs do container Coolify: `curl .../services/{uuid}/logs`. Se o container tem problemas, corrigir docker-compose ou usar pm2/systemd para gerir o processo nativo e actualizar o Coolify com docker-compose correcto.

---

### Issue 5: Sem systemd unit — sem arranque automático

**Problema:** ai-gateway corre via `nohup tsx src/index.ts &` — processo manual. Se a máquina reiniciar, o serviço não arranja.

**Fix:** Criar `~/.config/systemd/user/ai-gateway.service`:

```ini
[Unit]
Description=AI Gateway OpenAI-compat facade
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/monorepo/apps/ai-gateway
ExecStart=/usr/bin/node --require /srv/monorepo/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/preflight.cjs --import /srv/monorepo/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/srv/monorepo/.env

[Install]
WantedBy=default.target
```

Activar: `systemctl --user daemon-reload && systemctl --user enable --now ai-gateway`

---

### Issue 6: STT_DIRECT_URL vs STT_PROXY_URL — consistency check

**Problema:** PORTS.md e SUBDOMAINS.md mencionam:

- `:8202` — wav2vec2-large-xlsr-53-portuguese (canonical STT)
- `:8203` — zappro-wav2vec2-proxy (Deepgram API proxy → whisper-api :8201)

Mas audio-transcriptions.ts só usa `STT_DIRECT_URL` (→ :8202). Não há referência a `STT_PROXY_URL`. Isto é correcto pois SPEC-048 diz para usar :8202 directamente.

**Verificar:** `.env` deve ter `STT_DIRECT_URL=http://localhost:8202` (não :8201, não :8203).

---

## 3. Stack Validation (PORTS.md cross-check)

| Porta  | Serviço           | ai-gateway refere?                                          | Status     |
| ------ | ----------------- | ----------------------------------------------------------- | ---------- |
| :4002  | ai-gateway (este) | sim (self)                                                  | ✅ running |
| :4000  | LiteLLM           | chat.ts → LITELLM_URL                                       | ✅ running |
| :8013  | TTS Bridge        | audio-speech.ts → TTS_BRIDGE_URL                            | ✅ running |
| :8202  | wav2vec2 PT-BR    | audio-transcriptions.ts → STT_DIRECT_URL                    | ✅ running |
| :8203  | wav2vec2-proxy    | ❌ não referenciado (correcto — SPEC-048 canonical é :8202) | N/A        |
| :11434 | Ollama            | ptbr-filter.ts → OLLAMA_URL                                 | ✅ running |

**Conclusão:** Referências de porta consistentes com PORTS.md.

---

## 4. Deliverables

1. `apps/ai-gateway/src/schemas.ts` — TTS_ALLOWED_VOICES só `pm_santa`/`pf_dora`
2. `apps/ai-gateway/src/routes/audio-speech.ts` — validar voice e reject 400 se inválida
3. `smoke-tests/smoke-ai-gateway-quality.sh` — smoke test de qualidade PT-BR
4. `~/.config/systemd/user/ai-gateway.service` — systemd unit
5. `COOLIFY_SERVICE_UUID` documentado em `.env.example`
6. Verificar STT_DIRECT_URL em `.env` → :8202

---

## 5. Acceptance Criteria

- [ ] `TTS_ALLOWED_VOICES` só contém `pm_santa` e `pf_dora`
- [ ] `voice: 'alloy'` retorna 400 com mensagem clara
- [ ] smoke-ai-gateway-quality.sh corre e passa (STT bytes > 1KB, TTS bytes > 10KB, Vision PT-BR)
- [ ] `systemctl --user status ai-gateway` mostra active
- [ ] ai-gateway survive reboot via systemd
- [ ] `.env` tem `STT_DIRECT_URL=http://localhost:8202`
- [ ] Coolify deploy: container healthy ou processo nativo com pm2/systemd

---

## 6. O que NÃO fazer

- ❌ Mudar Kokoro para outra voz (SPEC-009 imutável)
- ❌ Mudar wav2vec2 :8202 para outro STT (SPEC-009 imutável)
- ❌ Adicionar vozes OpenAI ao schema
- ❌ Usar Infisical SDK
- ❌ Hardcoded URLs/portas

---

## 7. Dependencies

- SPEC-047 (ai-gateway scaffold)
- SPEC-048 (OpenAI facade completo)
- PORTS.md (:4002, :8013, :8202, :8203)
- SUBDOMAINS.md (llm.zappro.site → :4002 pending T400)
