# Plano: OpenClaw Agency — Voice-First Marketing & Design

**Data:** 2026-04-08 (reimaginada) | **Host:** will-zappro | **Bot:** @CEO_REFRIMIX_bot

---

## Visao

Ser a **primeira agencia de marketing voice-first do Brasil.** O cliente fala o briefing, recebe relatorios falados — tudo pelo Telegram. Sem formulários, sem planilhas, sem emails de acompanhamento.

**Diferenciador:** Nenhuma agencia concorrente entrega briefings por audio e relatorios falados. Isso reduz o tempo de briefing de 2 dias para 30 segundos.

**Tagline:** "Sua agencia que você SCAVIZZ."

---

## O Que Temos (Stack)

| Capacidade | Tecnologia | Diferencial Competitivo |
|-----------|------------|--------------------------|
| **Voice In** | wav2vec2 :8201 | Briefing por voz, natural |
| **Voice Out** | Kokoro pm_santa/pf_dora | Relatorios falados |
| **Visao** | llava via LiteLLM | Analise de designs, prints |
| **Memoria** | Qdrant 768d | Contexto de cliente/marca |
| **Automacao** | n8n + sub-agents | Pipeline completo |
| **Seguranca** | Infisical vault | Secrets nunca expostos |

---

## Arquitetura de Time Virtual

```
                    ┌─────────────────────────────────────────┐
                    │         CEO MIX (Leader)                │
                    │  @CEO_REFRIMIX_bot — Telegram            │
                    │  default: true                            │
                    │  - Unico ponto de contato                 │
                    │  - Voice-first (in/out)                   │
                    └─────────────────┬────────────────────────┘
                                      │ delega
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
    ┌──────────┐              ┌──────────┐               ┌──────────┐
    │ CREATIVE │              │  DESIGN  │               │  SOCIAL  │
    │ Copy,    │              │ Briefs,  │               │ Calendar,│
    │ headlines│              │ Brand    │               │ Publish, │
    │ AIDA/PAS │              │ guides,  │               │ Trends  │
    └──────────┘              │ llava    │               └──────────┘
                              └──────────┘                      │
                                  │                             │
                                  └─────────────────────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │   PROJECT    │
                                       │  Timelines,  │
                                       │  Reports,     │
                                       │  Status      │
                                       └──────────────┘
```

---

## Roadmap por Fase

### FASE 1: Voice Briefing (Semana 1)

**Objetivo:** Cliente envia audio → CEO MIX gera copy

```
1. Cliente envia audio de briefing (Telegram)
2. CEO MIX transcreve via wav2vec2 :8201
3. Busca brand guide do cliente no Qdrant
4. Gera copy com CREATIVE sub-agent
5. Retorna: texto + TTS preview (pm_santa)
```

**Entregaveis:**
- [ ] Skill `voice-briefing` operacional
- [ ] Qdrant `clients` populado com 1 cliente teste
- [ ] Copy gerada a partir de audio real

### FASE 2: Sub-Agents Operacionais (Semana 2-3)

**Objetivo:** Time virtual работает em paralelo

```
CEO MIX recebe briefing
    │
    ├── CREATIVE: "Gere copy AIDA para [produto]"
    ├── DESIGN: "Crie brief visual para [campanha]"
    └── SOCIAL: "Proponha 5 posts para [rede]"

Execução paralela → CEO MIX compila → Cliente aprova
```

**Entregaveis:**
- [ ] CREATIVE agent: SOUL.md + workspace
- [ ] DESIGN agent: SOUL.md + workspace
- [ ] SOCIAL agent: SOUL.md + workspace
- [ ] Delegacao funcional via Telegram

### FASE 3: Voice Reports (Semana 3-4)

**Objetivo:** Cliente recebe relatorios por audio

```
Todo dia 30:
CEO MIX compila relatorio mensal
    - Campanhas ativas
    - Metricas (impressoes, cliques, conversoes)
    - Proximos passos
    │
    ▼
TTS Bridge :8013 → Kokoro :8880
    │
    ▼
Audio no Telegram (pm_santa)
```

**Entregaveis:**
- [ ] Template de relatorio em Qdrant
- [ ] Geracao de relatorio automatica
- [ ] Envio por voice no Telegram

### FASE 4: Social Automation (Semana 4-5)

**Objetivo:** Publicacao automatica via n8n

```
Cliente aprova campanha
    │
    ▼
n8n workflow dispara
    │
    ├── Instagram (via API)
    ├── LinkedIn (via API)
    └── Telegram (notificacao)
```

**Entregaveis:**
- [ ] n8n workflow configurado
- [ ] Sub-agent SOCIAL com calendario
- [ ] Publicacao testada

### FASE 5: Brand Guide Engine (Semana 5-6)

**Objetivo:** Extrair brand guide automaticamente de imagens

```
Cliente envia imagens da marca
    │
    ▼
llava analiza: cores, fontes, estilo, tom
    │
    ▼
CEO MIX extrai brand guide
    │
    ▼
Qdrant upsert(brand_guide)
```

**Entregaveis:**
- [ ] Skill `brand-extractor` via llava
- [ ] Brand guide gerado automaticamente
- [ ] Validacao de consistencia

---

## Qdrant Collections

### `clients`
```json
{
  "payload": {
    "nome": "ACME Corp",
    "slug": "acme",
    "brand_guide": {
      "tom": "formal, confiavel",
      "cores": ["#1a365d", "#c53030"],
      "fontes": "Montserrat + Open Sans"
    },
    "contatos": { "telegram": "@manager_acme" },
    "redes": ["instagram", "linkedin"]
  }
}
```

### `campaigns`
```json
{
  "payload": {
    "cliente": "acme",
    "tipo": "lancamento",
    "copy": "...",
    "brief_visual": "...",
    "status": "aprovada|publicada|concluida"
  }
}
```

### `templates`
```json
{
  "payload": {
    "tipo": "briefing|campanha|post|report",
    "nome": "Nome do template",
    "estrutura": { ... }
  }
}
```

---

## Servicos (mesma rede Docker)

| Servico | Endpoint | Uso |
|---------|----------|-----|
| Qdrant | `qdrant-c95x...:6333` | Memoria vetorial |
| LiteLLM | `10.0.1.1:4000` | llava, nomic-embed |
| TTS Bridge | `10.0.19.5:8013` | pm_santa, pf_dora |
| wav2vec2 | `10.0.19.6:8201` | STT PT-BR |
| Kokoro | `10.0.19.7:8880` | TTS |
| n8n | `n8n:5678` | Automacao |

---

## Metricas de Sucesso

| Metrica | Target | Como Medir |
|---------|--------|------------|
| Tempo briefing → draft | <30 segundos | Log CEO MIX |
| Taxa aprovacao copy | >80% | Qdrant campaigns |
| Campanhas/mês/cliente | 4+ | Contagem Qdrant |
| NPS cliente | >8 | Pesquisa mensal |

---

## Governance (do Kit)

**PROIBIDO:**
- Alterar STT (wav2vec2 :8201)
- Alterar TTS Bridge (:8013) ou voces
- Usar outra voz que nao pm_santa/pf_dora
- Mudar LLM primary para LiteLLM

**REQUER APROVACAO:**
- Adicionar novo sub-agent
- Mudar binding de canal
- Publicar em nome do cliente

---

## Riscos e Mitigacoes

| Risco | Prob | Mitigacao |
|-------|------|-----------|
| Cliente nao adapta a voice | Media | Text fallback + mostrar speed |
| Token custo MiniMax | Alta | Cache brand guides |
| Inconsistencia marca | Media | llava validacao |
| Sub-agents divergem | Baixa | Governance template |

---

## REGRA DE OURO

```
MODELO PRIMARIO = minimax/MiniMax-M2.7 DIRETO
LITELLM = SOMENTE: llava, nomic-embed, kokoro-tts
VOICE = VOICE-FIRST — tudo comecou e termina em audio
```

---

**Spec:** [SPEC-011](./specflow/SPEC-011-openclaw-agency-reimagined.md)
**Tasks:** `tasks/todo-agency-reimagined.md`
**Plan:** `tasks/plan-agency-reimagined.md`
