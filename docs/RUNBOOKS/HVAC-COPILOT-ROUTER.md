# HVAC COPILOT ROUTER — Runbook

> Sistema de roteamento inteligente para assistência técnica HVAC com estado conversacional, busca vetorial e grafo de triagem.

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUÁRIO                                         │
│                    (Alarme, pergunta técnica, imagem)                        │
                                    │                                          │
                                    ▼                                          │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRAESTRUTURA                                      │
│  ┌──────────┐   ┌──────────────────┐   ┌───────────────────────────────┐  │
│  │  LiteLLM │◄──│  CopilotRouter   │──►│        MiniMax MCP             │  │
│  │  Proxy   │   │   (Decision Tree) │   │        (Web Search)           │  │
│  └────┬─────┘   └────────┬─────────┘   └───────────────────────────────┘  │
│       │                   │                      │                          │
│       │            ┌──────▼──────┐        ┌──────▼──────┐                 │
│       │            │   Juiz      │        │  DuckDuckGo │                 │
│       │            │(Classifica)  │        │  (Fallback) │                 │
│       │            └──────┬──────┘        └─────────────┘                 │
│       │                   │                                              │
│       │            ┌──────▼──────┐                                       │
│       │            │ Conversation │                                       │
│       │            │   State      │                                       │
│       │            │  (TTL: 30m)  │                                       │
│       │            └──────┬──────┘                                       │
│       │                   │                                              │
│       │     ┌─────────────┼─────────────┐                                │
│       │     │             │             │                                │
│       │     ▼             ▼             ▼                                │
│  ┌────▼─────┐  ┌────────────────┐  ┌─────────────┐                       │
│  │  Qdrant  │  │   TriageGraph  │  │   Ollama    │                       │
│  │ (Manuais)│  │   (Conhecimento)│  │ (Multimodal)│                       │
│  └──────────┘  └────────────────┘  └─────────────┘                       │
│       │                                                   ▲                │
│       │                                                   │                │
│       ▼                                           ┌───────────────┐         │
│  ┌──────────────────────────────────────────────│  Edge TTS     │         │
│  │              RESPOSTA AO USUÁRIO              │  (Voz)        │         │
│  └──────────────────────────────────────────────└───────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Componentes

| Componente | Função | Tecnologia |
|------------|--------|------------|
| **Juiz** | Classifica o tipo de query e extrai entidades (brand, model, alarm, family) | LiteLLM + prompts de classificação |
| **ConversationState** | Armazena estado conversacional por `conversation_id` com TTL de 30 min | Redis/in-memory |
| **CopilotRouter** | Decision tree que roteia para a fonte correta baseado na classificação | Python/TypeScript |
| **TriageGraph** | Grafo de conhecimento de triagem HVAC (sintomas → causas → soluções) | Neo4j ou JSON graph |
| **Qdrant** | Banco vetorial para busca de manuais técnicos | Qdrant Cloud/Self-hosted |
| **LiteLLM** | Proxy unificado para múltiplos LLMs | LiteLLM Proxy |
| **MiniMax MCP** | Busca web oficial (site do fabricante, documentação) | MiniMax API |
| **Ollama** | Multimodal (visão) e STT local | Ollama |
| **DuckDuckGo** | Busca web como fallback quando MiniMax falha | DuckDuckGo API |

### 1.3 Fluxo de Dados

```
Query do Usuário
       │
       ▼
┌──────────────┐
│   Juiz      │──── Extrai: brand, model, alarm, family, subcode
│ (Classifica) │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│              CopilotRouter (Decision Tree)           │
└──────┬────────────────┬─────────────────┬────────────┘
       │                │                 │
       ▼                ▼                 ▼
┌────────────┐   ┌────────────┐   ┌─────────────┐
│  Qdrant    │   │ TriageGraph│   │ Web Search  │
│(MANUAL_*)  │   │(GRAPH_*)   │   │(WEB_*)      │
└─────┬──────┘   └─────┬──────┘   └──────┬──────┘
      │                │                  │
      └────────────────┼──────────────────┘
                       ▼
              ┌─────────────────┐
              │   LiteLLM      │
              │ (Agrega resposta)│
              └────────┬────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│   Texto    │  │   Vozão    │  │   Imagem   │
│ (Markdown) │  │ (Edge TTS) │  │  (qwen2.5vl)│
└────────────┘  └────────────┘  └────────────┘
```

---

## 2. Modelos de Endpoint

### 2.1 Lista de Modelos

| Modelo | Uso | Indicado Quando |
|--------|-----|-----------------|
| `hvac-copilot` | **Padrão** | Assistente completo com estado, busca vetorial, grafo e web |
| `hvac-manual-strict` | Manuais exatos | Necessita precisão absoluta em manuais, sem contexto conversacional |
| `hvac-field-tutor` | Tutor de campo | Treinamento de técnicos, perguntas educativas |
| `hvac-printable` | Manuais imprimíveis | Geração de PDFs, manutenções documentadas |

### 2.2 Quando Usar Cada Modelo

```
hvac-copilot (DEFAULT)
├── Primeira consulta do técnico
├── Problema com múltiplas variáveis (brand + model + alarm)
├── Busca por causas comuns
├── Triagem inicial de problemas
└── Conversas longas com contexto acumulado

hvac-manual-strict
├── Busca por procedimento específico de serviço
├── Necessidade de CITAR página/seção exata do manual
├── Auditoria técnica que requer rastreabilidade
└── Quando o técnico já sabe o modelo e precisa de detalhes

hvac-field-tutor
├── Treinamento de novos técnicos
├── Explicações didáticas de conceitos HVAC
├── "Como funciona" ao invés de "Como consertar"
└── Sessões de capacitação

hvac-printable
├── Geração de relatórios de manutenção
├── Criação de manuais de procedimento
├── Documentação para entrega ao cliente
└── Exportação de checklists de serviço
```

---

## 3. Labels de Nível de Evidência

Cada resposta é etiquetada com um nível de evidência para o técnico avaliar a confiança:

| Label | Significado | Fonte |
|-------|-------------|-------|
| `manual exato` | Encontrou o modelo exato no Qdrant | Qdrant (busca vetorial) |
| `manual da família` | Encontrou apenas o manual da família (mesma série) | Qdrant (busca fuzzy) |
| `graph interno` | Usou conhecimento do grafo de triagem | TriageGraph |
| `fonte externa` | Usou busca web (MiniMax ou DuckDuckGo) | Web Search |

### 3.1 Interpretação dos Labels

```
┌─────────────────────────────────────────────────────────────┐
│                    NÍVEL DE CONFIANÇA                        │
├─────────────────────────────────────────────────────────────┤
│  [manual exato]          ████████████ 100%                 │
│  [manual da família]     ████████░░░░  70%                 │
│  [graph interno]         █████░░░░░░░  50%                 │
│  [fonte externa]         ████░░░░░░░░  40%                 │
└─────────────────────────────────────────────────────────────┘

⚠️  NÍVEL DE EVIDÊNCIA NÃO É GARANTIA DE CORREÇÃO
   Sempre valide com o manual oficial do equipamento.
```

---

## 4. Estado da Conversa

### 4.1 Rastreamento por conversation_id

Cada conversa recebe um `conversation_id` único que persiste o estado:

```python
{
  "conversation_id": "uuid-v4",
  "created_at": "2026-04-28T10:30:00Z",
  "last_accessed": "2026-04-28T10:45:00Z",
  "extracted_data": {
    "brand": "daikin",
    "family": "vrv",
    "model": "RXYQ20BRA",
    "indoor_unit": "FXYC20BRA",
    "alarm": "U4",
    "subcode": "001",
    "symptoms": [],
    "previous_queries": []
  },
  "evidence_level": "manual exato",
  "context_window": [
    {"role": "user", "content": "Alarme U4-001 Daikin VRV 4"},
    {"role": "assistant", "content": "Extraindo estado..."},
    {"role": "user", "content": "RXYQ20BRA + FXYC20BRA"}
  ]
}
```

### 4.2 Dados Extraídos e Armazenados

| Campo | Exemplo | Extraído De |
|-------|---------|-------------|
| `brand` | `daikin` | Alarme ou pergunta |
| `family` | `vrv`, `split`, `cassete` | Contexto |
| `model` | `RXYQ20BRA` | Input do usuário |
| `indoor_unit` | `FXYC20BRA` | Input do usuário |
| `alarm` | `U4` | Código de alarme |
| `subcode` | `001` | Código após hífen |
| `symptoms` | `["não liga", "falha compressor"]` | Descrição |

### 4.3 Comportamento do TTL

```
TEMPO
│
│  0 min              15 min           30 min        35 min
│   │                   │                │             │
│   ▼                   ▼                ▼             ▼
│  ┌───────────────────┬────────────────┬─────────────┐
│  │     ATIVO         │     ATIVO      │   ATIVO    │ EXPIRADO
│  │  (conversa OK)    │  (conversa OK) │(renew TTL) │ (estado limpo)
│  └───────────────────┴────────────────┴─────────────┘
│                        ▲
│                        │
│              User interage → TTL renova
```

- **TTL padrão:** 30 minutos sem interação
- **Renovação:** Qualquer mensagem do usuário renova o TTL
- **Expiração:** Estado é limpo, próxima query começa do zero

---

## 5. Árvore de Decisão do Router

```
                            Query Recebida
                                  │
                                  ▼
                         ┌───────────────┐
                         │     Juiz     │
                         │  (Classifica) │
                         └───────┬───────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
    │ MANUAL_EXACT  │    │MANUAL_FAMILY  │    │  GRAPH_*      │
    │ (model found) │    │(family only)  │    │ (no manual)   │
    └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
            │                    │                    │
            ▼                    ▼                    ▼
    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
    │ Qdrant Exact  │    │ Qdrant Family │    │  TriageGraph  │
    │   Search      │    │    Search     │    │    Query      │
    └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
            │                    │                    │
            │                    │                    │
            │              ┌─────┴─────┐              │
            │              │ Fallback? │              │
            │              └─────┬─────┘              │
            │                    ▼                   │
            │            ┌───────────────┐            │
            │            │ TriageGraph   │            │
            │            │   Fallback    │            │
            │            └───────┬───────┘            │
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    LITELLM (Agrega)     │
                    └───────────┬─────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
 ┌─────────────┐       ┌─────────────┐        ┌─────────────┐
 │   WEB_OFFI-  │       │  WEB_OFFI-  │        │    WEB_*    │
 │  CIAL_ASSIST │       │  CIAL_FAIL  │        │  (Fallback) │
 │(MiniMax OK)  │       │(MiniMax fail│        │(DuckDuckGo) │
 └─────────────┘       └──────┬──────┘        └─────────────┘
                              │
                              ▼
                      ┌─────────────┐
                      │ DuckDuckGo  │
                      │  (Fallback) │
                      └─────────────┘
```

### 5.1 Detalhamento das Decisões

| Decisão | Condição | Ação |
|---------|----------|------|
| `MANUAL_EXACT` | Juiz encontra modelo exato no Qdrant | Retorna manual + evidência `manual exato` |
| `MANUAL_FAMILY` | Apenas família/manual genérico encontrado | Retorna da família + evidência `manual da família` |
| `GRAPH_ASSISTED` | Sem manual ou família não identificada | Consulta TriageGraph → evidência `graph interno` |
| `WEB_OFFICIAL_ASSISTED` | Graph não tem resposta ou query é externa | MiniMax web search → evidência `fonte externa` |
| `WEB_DUCKDUCKGO` | MiniMax falha ou indisponível | DuckDuckGo fallback |

---

## 6. Stack Multimodal

### 6.1 Visão (Image Input)

```
Imagem do Equipamento
        │
        ▼
┌─────────────────┐
│   qwen2.5vl:3b  │  (via Ollama local)
│  (Multimodal)   │
└────────┬────────┘
         │
         ▼
   Análise de:
   - Placas/características
   - Modelo visual
   - Código de alarme
   - Estado físico
```

- **Modelo:** `qwen2.5vl:3b` (Ollama)
- **Uso:** Identificar modelo por foto, ler LEDs de erro, verificar instalação

### 6.2 Áudio (STT - Speech to Text)

```
Microfone do Técnico
        │
        ▼
┌─────────────────┐
│    Groq STT     │  (via LiteLLM)
│   (whisper)     │
└────────┬────────┘
         │
         ▼
   Transcrição →
   Query processada
```

- **Provedor:** Groq (via LiteLLM)
- **Modelo:** `whisper-large-v3` ou similar
- **Uso:** Técnicos em campo que não podem digitar

### 6.3 Voz (TTS - Text to Speech)

```
Resposta do Sistema
        │
        ▼
┌─────────────────┐
│    Edge TTS     │
│   (Microsoft)   │
└────────┬────────┘
         │
         ▼
   Áudio para o
   técnico em campo
```

- **Provedor:** Edge TTS (Microsoft)
- **Vantagem:** Offline possível com caching
- **Uso:** Leituras de procedimento enquanto técnico trabalha

---

## 7. Regras de Segurança

### 7.1 Regras Fundamentais

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                           ⚠️  REGRAS DE SEGURANÇA ⚠️                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  1. MEDIÇÕES ENERGIZADO                                                   ║
║     ┌──────────────────────────────────────────────────────────────────┐ ║
║     │ NUNCA forneça instruções de medição em equipamento energizado    │ ║
║     │ sem ter EXTRAÍDO o manual oficial com procedimento exato.         │ ║
║     └──────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
║  2. VALORES INVENTADOS                                                    ║
║     ┌──────────────────────────────────────────────────────────────────┐ ║
║     │ NUNCA invente valores de pressão, temperatura, amperagem.        │ ║
║     │ Se não houver manual → "Procedimento não verificado"             │ ║
║     └──────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
║  3. RESPOSTAS DO GRAFO                                                    ║
║     ┌──────────────────────────────────────────────────────────────────┐ ║
║     │ Respostas do TriageGraph são "PISTA INICIAL" apenas.             │ ║
║     │ Sempre cruzar com manual oficial antes de agir.                  │ ║
║     └──────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
║  4. AVISOS DE SEGURANÇA                                                   ║
║     ┌──────────────────────────────────────────────────────────────────┐ ║
║     │ TODO procedimento que envolva:                                  │ ║
║     │   • Trabalho em altura                                            │ ║
║     │   • Equipamento energizado                                        │ ║
║     │   • Refrigerantes inflamáveis (R-290, R-32)                        │ ║
║     │   • Pressurização                                                 │ ║
║     │ DEVE ter aviso de segurança MANDATÓRIO.                           │ ║
║     └──────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 7.2 Template de Aviso de Segurança

```markdown
> ⚠️ **AVISO DE SEGURANÇA**
>
> Este procedimento envolve [TRABALHO ENERGIZADO / TRABALHO EM ALTURA / REFRIGERANTE INFLAMÁVEL].
>
> Antes de continuar, certifique-se de:
> - [ ] Desligar e bloquear (LOTO) a alimentação elétrica
> - [ ] Consultar o manual oficial do fabricante
> - [ ] Usar EPIs adequados
> - [ ] Estar qualificado para este procedimento
>
> **Responsabilidade:** O técnico é responsável pela própria segurança.
```

---

## 8. Exemplo de Conversa: ANTES e DEPOIS

### 8.1 ANTES (hvac-manual-strict) — Sem Estado

**Problema:** Modelo stateless re-requer informações a cada pergunta.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER                          BOT (hvac-manual-strict)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  > Alarme U4-001 Daikin VRV 4                                              │
│                              │                                              │
│                              ▼                                              │
│                     [Extrai brand=daikin, alarm=U4]                        │
│                     [Estado DESCARTADO após resposta]                      │
│                                                                             │
│                     "Código U4 indica problema de comunicação              │
│                      entre unidades interna/externa.                       │
│                      Preciso do modelo completo da unidade externa          │
│                      e da unidade interna para dar procedimento."          │
│                                                                             │
│  > RXYQ20BRA + FXYC20BRA                                                   │
│                              │                                              │
│                              ▼                                              │
│                     [Busca manual RXYQ20BRA]                               │
│                     [Responde procedimento U4-001]                        │
│                     [Estado DESCARTADO]                                   │
│                                                                             │
│                     "Para o alarme U4-001 em RXYQ20BRA + FXYC20BRA:        │
│                      1. Verificar接线..."                                  │
│                                                                             │
│  > Quais são as causas mais comuns?                                        │
│                              │                                              │
│                              ▼                                              │
│                     [Estado JÁ FOI DESCARTADO]                             │
│                     [Não sabe do contexto anterior]                         │
│                                                                             │
│                     "Não tenho informações do modelo.                       │
│                      Por favor, forneça o modelo completo."                 │
│                                    ▲                                       │
│                                    │                                       │
│                         ══════════════════════════════                     │
│                         PROBLEMA: Requer novamente                          │
│                         modelo que já foi informado!                        │
│                         ══════════════════════════════                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 DEPOIS (hvac-copilot) — Com Estado

**Solução:** Estado persistente permite contexto acumulado.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER                          BOT (hvac-copilot)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  > Alarme U4-001 Daikin VRV 4                                              │
│                              │                                              │
│                              ▼                                              │
│                     [Juiz classifica + extrai estado]                       │
│                     [conversation_id gerado]                               │
│                     [Estado ARMAZENADO em Redis]                            │
│                                                                             │
│                     "Entendido! Extraí as seguintes informações:           │
│                                                                             │
│                      ┌─────────────────────────────┐                       │
│                      │ brand: Daikin               │                       │
│                      │ family: VRV                │                       │
│                      │ alarm: U4                  │                       │
│                      │ subcode: 001               │                       │
│                      │ modelo: [pendente]         │                       │
│                      │ unidade interna: [pendente]│                       │
│                      └─────────────────────────────┘                       │
│                                                                             │
│                      Preciso do modelo completo para o                    │
│                      procedimento exato."                                   │
│                                                                             │
│  > RXYQ20BRA + FXYC20BRA                                                   │
│                              │                                              │
│                              ▼                                              │
│                     [Recupera estado do conversation_id]                   │
│                     [Atualiza: modelo=RXYQ20BRA, uni=FXYC20BRA]           │
│                     [Busca manual exato no Qdrant]                        │
│                                                                             │
│                     "Perfeito! Modelo atualizado.                           │
│                      Alarme U4-001 em RXYQ20BRA + FXYC20BRA:              │
│                                                                             │
│                      **Causas mais comuns:**                              │
│                      1. Cabo de comunicação danificado (70%)               │
│                      2. Conector oxidado na unidade interna (20%)           │
│                      3. Fonte SMPS com defeito (10%)                        │
│                                                                             │
│                      **Procedimento:** [do manual exato]"                 │
│                                                                             │
│  > Quais são as causas mais comuns?                                        │
│                              │                                              │
│                              ▼                                              │
│                     [Recupera estado COMPLETO]                             │
│                     [Sabe brand, model, alarm, subcode]                    │
│                     [Consulta TriageGraph + Manual]                        │
│                                                                             │
│                     "Para RXYQ20BRA + FXYC20BRA com U4-001:               │
│                                                                             │
│                      **Causas mais comuns (do grafo de triagem):**         │
│                      1. Cabo de comunicação - Verificar continuidade       │
│                      2. Conector X501 - Limpar/realizar                                             │
│                      3. Placa receptora - Substituir se necessário         │
│                                                                             │
│                      [graph interno]                                      │
│                                                                             │
│                      ⚠️ Para medições energized,                           │
│                         consulte o manual oficial."                        │
│                                    ▲                                       │
│                                    │                                       │
│                         ══════════════════════════════                     │
│                         CORRIGIDO: Usa contexto      ║
│                         anterior para responder!    ║
│                         ══════════════════════════════                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Comparativo

| Aspecto | hvac-manual-strict | hvac-copilot |
|---------|---------------------|--------------|
| **Estado** | Descartado após cada resposta | Persiste por 30 min |
| **Requer modelo** | Sempre, mesmo que já informado | Só na primeira vez |
| **Contexto** | Nenhum | Accumula brand, model, alarm |
| **Resposta "causas comuns"** | Requer modelo novamente | Usa contexto, responde direto |
| **Evidência** | Manual exato apenas | Manual + Graph + Web |

---

## 9. Casos de Teste

### 9.1 Cenários Obrigatórios

| # | Cenário | Input | Output Esperado |
|---|---------|-------|-----------------|
| 1 | **Alarme completo** | `"Alarme U4-001 Daikin VRV 4"` + `"RXYQ20BRA"` | Extrai estado, busca manual, retorna procedimento |
| 2 | **Pergunta sem modelo** | `"O que significa alarme E6?"` | Usa TriageGraph, retorna sem manual |
| 3 | **Estado acumulado** | Sequência: alarme → modelo → "causas comuns" | Segunda pergunta usa contexto da primeira |
| 4 | **Fallback web** | Query não coberta por manual nem graph | MiniMax → DuckDuckGo fallback |
| 5 | **Imagem de placa** | Envio de foto da placa do equipamento | qwen2.5vl extrai modelo da imagem |

### 9.2 Casos de Teste Detalhados

```bash
# CASO 1: Fluxo completo de alarme
# ============================================
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hvac-copilot",
    "messages": [{"role": "user", "content": "Alarme U4-001 Daikin VRV 4"}],
    "conversation_id": null
  }'
# Esperado: conversation_id retornado, estado extraído

# CASO 2: Pergunta técnica sem contexto
# ============================================
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hvac-copilot",
    "messages": [{"role": "user", "content": "Como funciona sensor de temperatura?"}],
    "conversation_id": null
  }'
# Esperado: TriageGraph responde, evidência "graph interno"

# CASO 3: Estado acumulado
# ============================================
CONV_ID="test-123"
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"hvac-copilot\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Alarme P2 Daikin\"}],
    \"conversation_id\": \"$CONV_ID\"
  }"
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"hvac-copilot\",
    \"messages\": [{\"role\": \"user\", \"content\": \"RXYQ30BRA\"}],
    \"conversation_id\": \"$CONV_ID\"
  }"
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"hvac-copilot\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Quais as causas do P2?\"}],
    \"conversation_id\": \"$CONV_ID\"
  }"
# Esperado: Terceira chamada usa contexto das duas anteriores

# CASO 4: Fallback web
# ============================================
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hvac-copilot",
    "messages": [{"role": "user", "content": "Qual a pressão de trabalho do R-410A?"}],
    "conversation_id": null
  }'
# Esperado: MiniMax busca web, evidência "fonte externa"

# CASO 5: Imagem (multimodal)
# ============================================
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: multipart/form-data" \
  -F "image=@placa_rxyq.jpg" \
  -F "message=Qual modelo está nessa placa?" \
  -F "conversation_id=test-img"
# Esperado: qwen2.5vl identifica modelo da imagem
```

### 9.3 Critérios de Aprovação

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHECKLIST DE VALIDAÇÃO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  □ CASO 1: conversation_id gerado na primeira chamada           │
│  □ CASO 1: Estado extraído (brand, alarm)                       │
│  □ CASO 1: Evidência "manual exato" ou "manual família"        │
│                                                                 │
│  □ CASO 2: Resposta do TriageGraph                             │
│  □ CASO 2: Evidência "graph interno"                           │
│  □ CASO 2: Sem erro mesmo sem modelo                           │
│                                                                 │
│  □ CASO 3: Terceira chamada retorna contexto correto           │
│  □ CASO 3: Não pede modelo novamente                           │
│  □ CASO 3: Resposta específica para modelo acumulado           │
│                                                                 │
│  □ CASO 4: MiniMax ou DuckDuckGo acionado                     │
│  □ CASO 4: Evidência "fonte externa"                           │
│  □ CASO 4: Fallback funciona se MiniMax falhar                 │
│                                                                 │
│  □ CASO 5: Modelo extraído da imagem                           │
│  □ CASO 5: Fallback texto se imagem falhar                     │
│                                                                 │
│  □ TTL: Estado expira após 30 min sem interação                │
│  □ TTL: Estado renova ao receber nova mensagem                  │
│                                                                 │
│  □ SEGURANÇA: Aviso em procedimentos energized                 │
│  □ SEGURANÇA: Nunca inventa valores de medição                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Referências Rápidas

### 10.1 Variáveis de Ambiente

```bash
# LiteLLM
LITELLM_MASTER_KEY=sk-zappro-...

# Qdrant
QDRANT_API_KEY=71cae776...
QDRANT_URL=http://localhost:6333

# MiniMax MCP
MINIMAX_API_KEY=sk-cp-...
MINIMAX_WEBSEARCH_URL=https://api.minimax.chat

# Ollama (Multimodal)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5vl:3b

# Redis (Estado)
REDIS_URL=redis://localhost:6379
STATE_TTL_SECONDS=1800  # 30 min

# Edge TTS
EDGE_TTSvoice=pt-BR-FranciscaNeural
```

### 10.2 Comandos Úteis

```bash
# Testar router diretamente
curl http://localhost:4000/health

# Ver estado de uma conversa
redis-cli GET "hvac:state:conversation_id"

# Limpar estado manualmente
redis-cli DEL "hvac:state:conversation_id"

# Ver logs do router
journalctl -u hvac-copilot -f

# Testar busca no Qdrant
curl -X POST http://localhost:6333/collections/hvac-manuals/points/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, ...], "limit": 5}'
```

---

**Versão:** 1.0.0
**Última atualização:** 2026-04-28
**Manutenção:** Plataforma AI - Equipe HVAC
