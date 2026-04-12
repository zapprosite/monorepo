# SPEC-014: OpenClaw TTS Route — Corrigir Bridge + Voice

**Status:** SPEC
**Created:** 2026-04-09
**Author:** will + Claude Code

---

## Resumo

Corrigir a rota TTS do OpenClaw para passar pelo TTS Bridge (`:8013`) com a voz correta (`pm_santa`). O problema atual: TTS Bridge está DOWN, OpenClaw ignora o bridge e vai direto ao Kokoro, voz `pm_alex` não é filtrada.

---

## Problema: 3 Camadas de Mismatch

| Layer | Atual (ERRADO) | Deveria Ser |
|-------|---------------|-------------|
| TTS Route | Kokoro direto `:8880` | TTS Bridge `:8013` |
| Voice | `pm_alex` | `pm_santa` |
| BaseUrl | `http://10.0.19.7:8880` | `http://10.0.19.5:8013` |

### Sintomas
- TTS Bridge exited (137 = OOM kill)
- OpenClaw não passa pelo bridge
- Vozes soam idênticas (Kokoro sem filtro usa default)
- Smoke test passa (testa bridge diretamente) mas produção não usa bridge

---

## Componentes a Investigar (50 agents)

### Grupo A — OpenClaw Config (10 agents)
1. Ver config real do container (docker exec cat /data/.openclaw/openclaw.json)
2. Extrair TTS config path do source code OpenClaw
3. Listar todas as variáveis de ambiente do container
4. Verificar se `OPENAI_TTS_BASE_URL` está setado
5. Verificar se `OPENCLAW_CONFIG_JSON` está setado
6. Mapear ordem de merge de config (qual sobrepõe qual)
7. Identificar onde `pm_alex` está definido (json ou env)
8. Ver se existe mais de um container OpenClaw
9. Listar networks do container (quais alcança Kokoro vs Bridge)
10. Ver logs do container para erros de TTS

### Grupo B — TTS Bridge (10 agents)
1. Ver por que exit 137 (OOM)
2. Ver logs do container antes de morrer
3. Ver limits de memória do container (docker inspect)
4. Ver se há restart policy configurado
5. Ver como o TTS Bridge foi originalmente started
6. Verificar se porta 8013 está binding no host
7. Testar TTS Bridge quando subir
8. Verificar health endpoint do bridge
9. Comparar TTS Bridge config vs Kokoro config
10. Criar plano de restart com limits adequados

### Grupo C — Kokoro Direct Route (10 agents)
1. Listar vozes disponíveis no Kokoro
2. Testar pm_alex direto no Kokoro (retorna 200?)
3. Testar pm_santa direto no Kokoro
4. Verificar se Kokoro ignora voz inválida ou retorna erro
5. Ver hashes MD5 de pm_alex vs pm_santa (são diferentes?)
6. Testar texto idêntico com vozes diferentes (direct)
7. Ver se LiteLLM está roteando TTS para Kokoro
8. Verificar model `tts-1` vs `kokoro` no LiteLLM
9. Testar via LiteLLM proxy com pm_alex
10. Testar via LiteLLM proxy com pm_santa

### Grupo D — LiteLLM TTS Route (10 agents)
1. Ver config LiteLLM (como roteia tts-1/kokoro)
2. Listar modelos TTS no LiteLLM
3. Testar /v1/audio/speech via LiteLLM com kokoro model
4. Testar via LiteLLM com tts-1 model
5. Ver se LiteLLM valida voice parameter
6. Mapear LiteLLM → Kokoro route completa
7. Verificar se LiteLLM tem cache de TTS
8. Testar latency LiteLLM vs direct Kokoro
9. Ver se LiteLLM passa voice field corretamente
10. Documentar rota LiteLLM para TTS

### Grupo E — Rede e Connectivity (10 agents)
1. Ver networks do OpenClaw container
2. Ver networks do TTS Bridge container
3. Ver networks do Kokoro container
4. Descobrir IP do TTS Bridge na rede Coolify
5. Descobrir IP do Kokoro na rede Coolify
6. Testar conectividade OpenClaw → TTS Bridge
7. Testar conectividade OpenClaw → Kokoro direto
8. Ver se Traefik está no path do TTS
9. Ver regras de firewall/iptables
10. Mapear rota completa: OpenClaw → ??? → Kokoro

---

## Acões de Fix

### Fix 1: Restart TTS Bridge
```bash
docker run -d \
  --name zappro-tts-bridge \
  --restart unless-stopped \
  --memory=512m \
  --memory-swap=512m \
  -p 127.0.0.1:8013:8013 \
  --network=qgtzrmi6771lt8l7x8rqx72f \
  python:3.11-slim \
  python /srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py
```

### Fix 2: Atualizar OpenClaw config
```json
{
  "messages": {
    "tts": {
      "auto": "inbound",
      "provider": "openai",
      "openai": {
        "apiKey": "not-needed",
        "baseUrl": "http://10.0.19.5:8013/v1",
        "model": "kokoro",
        "voice": "pm_santa"
      }
    }
  }
}
```

### Fix 3: Atualizar docs conflitantes
- openclaw-mcp-setup.md (aponta :8880 direto) → corrigir para :8013
- openclaw-training.md (aponta pm_alex) → corrigir para pm_santa

---

## Verification

1. TTS Bridge UP na porta 8013
2. `curl http://localhost:8013/health` → 200
3. `curl -X POST http://localhost:8013/v1/audio/speech -d '{"voice":"pm_santa",...}'` → 200
4. `curl -X POST http://localhost:8013/v1/audio/speech -d '{"voice":"pm_alex",...}'` → 400
5. OpenClaw container com config atualizado
6. Smoke test passa 15/15

---

## Acceptance Criteria

| # | Critério | Teste |
|---|----------|-------|
| AC-1 | TTS Bridge UP + memory limits | `docker ps` mostra running |
| AC-2 | pm_alex bloqueado (400) | curl test |
| AC-3 | pm_santa funciona (200) | curl test |
| AC-4 | OpenClaw config usa Bridge | docker exec cat config |
| AC-5 | OpenClaw usa pm_santa | docker exec cat config |
| AC-6 | Smoke test passa 15/15 | bash smoke test |
| AC-7 | Docs atualizados | Sem referências a :8880 ou pm_alex |

---

## Referencias

- SPEC-025-openclaw-ceo-mix-voice-stack.md
- docs/OPERATIONS/SKILLS/tts-bridge.py
- docs/guides/openclaw-mcp-setup.md
- .claude/rules/openclaw-audio-governance.md