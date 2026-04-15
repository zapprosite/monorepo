# PLAN: Audio Stack Integration — LiteLLM + OpenClaw

**Data:** 08/04/2026
**Status:** RESEARCHING (3 agents executing in parallel)
**Meta:** Stack unificada TTS/STT/Vision via LiteLLM para OpenClaw Bot

---

## Contexto Atual

### Estado dos Serviços (08/04/2026 10:45)

| Serviço | Porta | Status | VRAM | Notas |
|---------|-------|--------|------|-------|
| **wav2vec2 STT** | :8201 | ✅ OK | ~2GB | Host Python, PT-BR native |
| **Kokoro TTS** | :8012 | ✅ OK | ~0.5GB | Container GPU |
| **LiteLLM Proxy** | :4000 | ⚠️ ERROR | - | Não carrega modelos do config |
| **Ollama** | :11434 | ✅ OK | ~0GB | Nenhum modelo carregado |

### Problema Identificado

LiteLLM não carrega modelos do config.yaml quando rodando no Docker com `--network host` ou `-p 4000:4000`:
- `localhost` no container ≠ `localhost` no host
- `ollama/llava:latest` usa `http://10.0.1.1:11434` mas LiteLLM não conecta
- `openai/whisper-1` com `http://localhost:8201` não funciona do container

---

## Arquitetura Alvo

```
OpenClaw Bot (Telegram)
       │
       ├─► LLM: LiteLLM :4000 ──► Ollama :11434 (gemma2-9b-it, llava)
       │
       ├─► TTS: LiteLLM :4000 ──► Kokoro :8012
       │                              └── vozes: pm_santa (M), pf_dora (F)
       │
       └─► STT: LiteLLM :4000 ──► wav2vec2 :8201
                                   └── PT-BR native STT
```

---

## Dependências Entre Componentes

```
1. Ollama (10.0.1.1:11434)
   └─ gemma2-9b-it:q4 carregado
   └─ llava:latest carregado
   └─ nomic-embed-text carregado

2. Kokoro TTS (:8012) ← Depende de nada
   └─ Container: zappro-kokoro
   └─ Rede: zappro-lite (acesso via 10.0.2.4)

3. wav2vec2 STT (:8201) ← Depende de nada
   └─ Script Python host
   └─ Rede: host localhost

4. LiteLLM Proxy (:4000) ← Depende de todos
   └─ Precisa conectar em Ollama (10.0.1.1:11434)
   └─ Precisa conectar em Kokoro (10.0.2.4:8880)
   └─ Precisa conectar em wav2vec2 (localhost:8201 do host)
```

---

## Fases de Implementação

### Fase 1: LiteLLM Config Correto
**Meta:** LiteLLM carregar todos os modelos

```
Tarefas:
- [ ] Corrigir network mode do LiteLLM (host network?)
- [ ] Usar prefixo openai/ para todos os modelos locais
- [ ] Declarar model_info.mode para audio
- [ ] Testar /v1/models retornando modelos正确
- [ ] Testar transcrição via LiteLLM
```

### Fase 2: Ollama Model Loading
**Meta:** Ollama com gemma2-9b-it:q4 + llava carregados

```
Tarefas:
- [ ] Verificar se gemma2-9b-it:q4 está no Ollama
- [ ] Carregar modelo se necessário
- [ ] Testar inferência via LiteLLM
```

### Fase 3: OpenClaw Integration
**Meta:** OpenClaw Bot usando LiteLLM para TTS/STT

```
Tarefas:
- [ ] Configurar OpenClaw providers para LiteLLM
- [ ] Testar TTS pm_santa via LiteLLM
- [ ] Testar STT wav2vec2 via LiteLLM
- [ ] Testar E2E voice pipeline
```

---

## Questões em Aberto (Aguardando Agent Research)

1. **Network Docker→Host:** Como LiteLLM no container acessa `localhost:8201` no host?
2. **Speaches:** vale a pena trocar wav2vec2 por speaches-ai/speaches?
3. **OpenClaw Config:** Como exatamente configurar providers no openclaw.json?

---

## VRAM Budget (RTX 4090 — 24GB)

| Componente | VRAM | Status |
|-----------|------|--------|
| Desktop (Xorg + gnome) | ~0.7GB | Fixed |
| Kokoro TTS | ~0.5GB | ✅ |
| wav2vec2 STT | ~2GB | ✅ |
| gemma2-9b-it:q4 | ~14GB | Carregar |
| llava | ~5GB | Opcional |
| **Total** | ~22GB | |

**Sobra:** ~2GB para buffer/OS

---

## Referências

- SPEC-004: Kokoro TTS Kit
- SPEC-005: wav2vec2 STT Kit
- LiteLLM Audio Transcription Docs
- OpenClaw Providers Config
