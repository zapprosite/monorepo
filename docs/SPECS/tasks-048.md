# Pipeline — SPEC-048 OpenAI Facade Completo

**SPEC:** [SPEC-048](SPEC-048-openai-facade-completo.md)
**Base:** SPEC-047 scaffold já feito (ai-gateway :4002 a correr)

## Phase 1 — Vision (gpt-4o-vision alias)

- [ ] T100 — Adicionar routing em `chat.ts`: se `model === "gpt-4o-vision"` → forward para LiteLLM com model `ollama/qwen2.5vl:7b` (multipart/json com imagens)
- [ ] T101 — Testar: `curl /v1/chat/completions -d '{"model":"gpt-4o-vision","messages":[...]}'` com image_url

## Phase 2 — TTS com PT-BR filter melhorado

- [ ] T200 — Melhorar prompt do PT-BR filter em `ptbr-filter.ts` para TTS (símbolos → palavras, títulos → pausa, listas numeradas)
- [ ] T201 — `audio-speech.ts`: aplicar PT-BR filter **sempre** antes de enviar para TTS Bridge
- [ ] T202 — Testar: texto com símbolos `→ • 1. Item` → voz natural sem ler símbolos
- [ ] T203 — Testar: vozes `pm_santa` (default) e `pf_dora` respondem correctamente

## Phase 3 — STT directo para whisper-api

- [ ] T300 — Confirmar `audio-transcriptions.ts` aponta para `:8204` (whisper-medium-pt OpenAI-compat nativo) em vez de `:8203` (wav2vec2-proxy Deepgram-format)
- [ ] T301 — Testar: `curl /v1/audio/transcriptions -F "file=@audio.wav" -F "model=whisper-1"` retorna `{"text":"..."}`

## Phase 4 — Tunnel Rerouting (requer aprovação humana)

- [x] T400 — ✅ DONE (2026-04-15): rerouting aprovado e executado via Terraform + cloudflared restart
- [x] T401 — ✅ DONE: Cloudflare tunnel ingress actualizado (llm.zappro.site → :4002 via CLOUDFLARE_API_TOKEN)
- [x] T402 — ✅ DONE: SUBDOMAINS.md actualizado (synced 2026-04-15)
- [x] T403 — ✅ DONE: PORTS.md actualizado (SPEC-050 T35)

## Phase 5 — Smoke & Polish

- [ ] T500 — `smoke-tests/smoke-openai-facade-full.sh`: texto + visão + TTS + STT via llm.zappro.site
- [ ] T501 — Atualizar `SPEC-INDEX.md`
- [ ] T502 — Atualizar CLAUDE.md: `llm.zappro.site` = ai-gateway (texto+visão+voz)
- [ ] T503 — `/sec` audit final
