# SPEC-HVAC-COPILOT — HVAC Copilot Router

## Problema

O sistema HVAC RAG está engessado em `manual_strict`. O Juiz julga cada mensagem isolada, sem usar histórico da conversa. Quando o manual exato não é encontrado, o sistema trava em vez de usar fallback.

## Decisão

- Manter `hvac-manual-strict` como modo rígido/auditoria.
- Criar `hvac-copilot` como modo principal de atendimento real.
- Juiz vira **roteador**, não porteiro.
- Se manual exato não achar → manual_family → graph → MiniMax MCP web_search → DuckDuckGo fallback.
- Toda resposta rotula nível de evidência.

## Stack

- Minimax M2.7 via LiteLLM — motor de instrução
- Qdrant `hvac_manuals_v1` — manuais indexados
- `qwen2.5vl:3b` via Ollama — visão (display, etiqueta, placa)
- Groq STT — áudio para texto
- Edge TTS — texto para voz
- MiniMax MCP `web_search` + `understand_image` — busca oficial
- DuckDuckGo — fallback

## Evidence Ladder

```
Nível 1 — Manual exato do modelo
Nível 2 — Manual da família VRV/VRF
Nível 3 — Graph técnico interno
Nível 4 — Fonte oficial/fabricante via MiniMax MCP
Nível 5 — DuckDuckGo fallback (marcado como não oficial)
```

## Arquivos a criar/modificar

### Novos
- `scripts/hvac-rag/hvac-conversation-state.py` — extrai e mantém contexto da conversa
- `scripts/hvac-rag/hvac-copilot-router.py` — router principal hvac-copilot
- `scripts/hvac-rag/hvac-triage-graph.py` — motor de busca no graph
- `data/hvac-graph/hvac-triage-graph.yaml` — graph de triagem YAML
- `docs/RUNBOOKS/HVAC-COPILOT-ROUTER.md` — runbook do sistema

### Modificar
- `scripts/hvac-rag/hvac-juiz.py` — novos modos de roteamento
- `scripts/hvac-rag/hvac-rag-pipe.py` — integrar conversation_state + graph fallback
- `scripts/hvac-rag/hvac-guided-responses.py` — evidence ladder
- OpenWebUI pipe/model config — expor hvac-copilot como padrão

## Tarefas

### T1: conversation_state
Criar `hvac-conversation-state.py`:
- Extrair do histórico: brand, family, alarm_code, subcode, outdoor_model, indoor_model, last_mode, evidence_seen
- Se pergunta curta, expandir com contexto anterior
- Manter estado entre mensagens

### T2: triage_graph
Criar `data/hvac-graph/hvac-triage-graph.yaml`:
```yaml
daikin_vrv:
  alarms:
    E4:
      family: low_pressure
      likely_meaning: "Baixa pressão"
      ask_next: "Confirma se aparece E4-01/E4-001, E4-02 ou E4-03?"
      split_warning: "Split/Hi-Wall pode usar tabela diferente de VRV."
      evidence_level: graph_knowledge
    U4:
      family: communication
      likely_meaning: "Falha/comunicação entre unidades ou placas"
      ask_next: "Confirma se aparece U4, U4-01 ou U4-001?"
      evidence_level: graph_knowledge
```

### T3: atualizar_juiz
Atualizar JuizResult com novos modos:
- BLOCKED
- ASK_ONE_SIMPLE_QUESTION
- GUIDED_TRIAGE
- MANUAL_EXACT
- MANUAL_FAMILY
- GRAPH_ASSISTED
- WEB_OFFICIAL_ASSISTED
- FIELD_TUTOR
- PRINTABLE

Meta returned: mode, evidence_level, allowed_sources, can_use_graph, can_use_web_official

### T4: hvac_copilot_router
Criar `hvac-copilot-router.py`:
- Recebe query + conversation_state
- Consulta Juiz para modo
- Se MANUAL_EXACT not_found → MANUAL_FAMILY
- Se MANUAL_FAMILY not_found → GRAPH_ASSISTED
- Se GRAPH_ASSISTED fraco → WEB_OFFICIAL_ASSISTED
- Gera resposta com evidence ladder

### T5: modelos_openwebui
Criar config de modelos em `/v1/models`:
- hvac-copilot (padrão)
- hvac-manual-strict
- hvac-field-tutor
- hvac-printable

### T6: evidence_ladder
Implementar evidence ladder em respostas:
```
O que sei com boa confiança:
[Nível 1 ou 2]

O que ainda preciso confirmar:
[pergunta simples]

Próximo passo:
[ação segura]
```

### T7: multimodal
- qwen2.5vl para imagens (display, etiqueta, placa)
- Groq STT para áudio
- Edge TTS para saída voz

### T8: web_search_fallback
- MiniMax MCP web_search como primeira busca externa
- DuckDuckGo como fallback
- Só quando manual+graph insuficientes

## Testes

1. Conversa com follow-up:
   - "Alarme U4-001 Daikin VRV 4" → context stored
   - "RXYQ20BRA + FXYC20BRA" → models stored
   - "Quais são as causas mais comuns?" → NÃO pedir modelo; responder com contexto

2. "Existe algum procedimento para resetar U4-001?"
   → Explicar que reset sem diagnosticar pode mascarar; sugerir caminho seguro

3. "erro e4 vrv daikin" → GUIDED_TRIAGE

4. Imagem de display com qwen2.5vl → extrair código/modelo

5. Out-of-domain → BLOCKED

## Validações

```bash
python3 -m py_compile scripts/hvac-rag/*.py
python3 scripts/hvac-rag/hvac-juiz.py --validate
python3 scripts/hvac-rag/hvac-daily-smoke.py --once
git diff --check
```

## Restrições

- NÃO reindexar Qdrant
- NÃO baixar PDFs novos
- NÃO expor Qdrant
- NÃO mexer Terraform/Cloudflare
- NÃO habilitar cliente final automático
- Scope: só patching do pipe existente + novos arquivos
