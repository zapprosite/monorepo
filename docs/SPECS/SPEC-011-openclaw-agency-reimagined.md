# SPEC-011 — OpenClaw Agency Suite: Reimaginado
<!-- ================================================================
     SPEC-011-openclaw-agency-reimagined-v2.md
     Status      : DRAFT v2.0
     Data        : 2026-04-09
     Autor       : Arquiteto Sênior de Software (sessão de brainstorm)
     Revisão     : —
     Plataforma  : OpenClaw (https://github.com/openclaw/openclaw)
     Contexto    : Agência de Marketing & Design — stack Docker em rede interna
================================================================ -->

---

**Status:** `DRAFT v2.0`  
**Data:** 09 de abril de 2026  
**Autor:** Sessão de Arquitetura Sênior  
**Plataforma-alvo:** OpenClaw (Gateway WS + multi-canal)  
**Ambiente:** Rede Docker interna (SPEC-011)  
**Idioma:** Português (PT-BR)  

---

## Índice

1. [Declaração do Problema](#1-declaração-do-problema)
2. [Visão Expandida](#2-visão-expandida)
3. [Stack Atual — Diagrama](#3-stack-atual--diagrama)
4. [Arquitetura Completa de Agentes](#4-arquitetura-completa-de-agentes)
5. [Especificação Detalhada de Cada Agente](#5-especificação-detalhada-de-cada-agente)
   - 5.1 CEO MIX — Orquestrador Principal
   - 5.2 EDITOR DE VÍDEO
   - 5.3 ORGANIZADOR
   - 5.4 ONBOARDING
   - 5.5 CREATIVE (Copywriter)
   - 5.6 DESIGN
   - 5.7 SOCIAL MEDIA
   - 5.8 PROJECT MANAGER
   - 5.9 ANALYTICS
   - 5.10 BRAND GUARDIAN
   - 5.11 CLIENT SUCCESS
6. [Schema Qdrant — Todas as Coleções](#6-schema-qdrant--todas-as-coleções)
7. [Estrutura de Pastas Completa](#7-estrutura-de-pastas-completa)
8. [Diagramas de Fluxo — Workflows Chave](#8-diagramas-de-fluxo--workflows-chave)
9. [Exemplos TaskFlow](#9-exemplos-taskflow)
10. [Especificações de Cron Jobs](#10-especificações-de-cron-jobs)
11. [Especificações dos Canvas Dashboards](#11-especificações-dos-canvas-dashboards)
12. [Especificações de Workflows n8n](#12-especificações-de-workflows-n8n)
13. [Tabela de Decisão de Roteamento](#13-tabela-de-decisão-de-roteamento)
14. [Matriz de Riscos](#14-matriz-de-riscos)
15. [Roadmap por Fases](#15-roadmap-por-fases)
16. [Métricas de Sucesso](#16-métricas-de-sucesso)
17. [Apêndices](#17-apêndices)

---

## 1. Declaração do Problema

### 1.1 Contexto Atual

Uma agência de marketing e design moderna opera com múltiplos papéis humanos — editores de vídeo, designers, gestores de social media, copywriters, gerentes de projeto, analistas, atendimento ao cliente e o próprio dono da agência. Cada um desses profissionais lida diariamente com tarefas repetitivas, fragmentação de informação entre ferramentas distintas (Notion, Google Drive, Trello, WhatsApp, e-mail, Canva, Premiere, etc.) e perda de contexto entre projetos.

**Problemas identificados:**

| Categoria | Problema | Impacto |
|-----------|----------|---------|
| Comunicação | Briefings chegam por WhatsApp, e-mail e reunião sem consolidação | Retrabalho estimado em 30% do tempo produtivo |
| Onboarding de clientes | Processo manual, sem padronização, dependente de pessoa-chave | Risco operacional alto; onboarding leva 3–5 dias úteis |
| Vídeo | Decupagem manual de footage, geração de legendas manual | Editor gasta ~40% do tempo em tarefas não-criativas |
| Organização de arquivos | Estrutura de pastas ad hoc por cliente, sem nomenclatura padrão | Tempo médio para localizar asset: 15–20 min |
| Identidade de marca | Consistência de brand verificada visualmente de forma subjetiva | Erros de cor/tipografia passam para aprovação final |
| Relatórios | Relatórios mensais feitos manualmente por analista | 8–12h/mês por cliente; dados inconsistentes |
| Gestão de projetos | Status em planilhas, Trello ou WhatsApp sem consolidação | Deadlines perdidos; cliente sem visibilidade |
| Relacionamento | Follow-up de satisfação dependente de iniciativa humana | Churn silencioso não é detectado a tempo |

### 1.2 Hipótese Central

> **Se um conjunto de agentes de IA especializados — cada um com personalidade, voz, memória e ferramentas próprias — operar de forma coordenada via protocolo ACP dentro da plataforma OpenClaw, então a agência pode eliminar as tarefas repetitivas de baixo valor, aumentar a qualidade e consistência das entregas, e escalar sua capacidade sem contratação proporcional.**

### 1.3 Escopo Deste SPEC

Este documento especifica a reimaginação completa do SPEC-011, focada em **agentes que facilitam a vida de todos os membros de uma agência de marketing/design**. O sistema é construído sobre a plataforma OpenClaw com os serviços Docker já disponíveis na rede SPEC-011.

---

## 2. Visão Expandida

### 2.1 Visão do Produto

**"Uma agência onde nenhuma tarefa repetitiva precisa ser feita duas vezes por um humano."**

O OpenClaw Agency Suite transforma o OpenClaw em um sistema nervoso central da agência, onde:

- **Clientes** se comunicam via Telegram/WhatsApp com o CEO MIX e recebem atualizações proativas
- **Editores de vídeo** recebem footage já organizado, decupado e com legendas geradas automaticamente
- **Designers** recebem briefs estruturados com paleta de cores, dimensões de plataforma e referências consolidadas
- **Social media managers** têm calendário de conteúdo gerenciado, posts agendados e analytics automáticos
- **Gerentes de projeto** têm TaskBoard em Canvas com status em tempo real
- **O dono da agência** recebe relatório de saúde geral da agência por voz todas as manhãs

### 2.2 Princípios de Design

1. **Voice-first**: Toda interação pode ser iniciada por voz (wav2vec2 PT-BR)
2. **Memória persistente**: Cada agente conhece o histórico do cliente via Qdrant
3. **Consistência de marca**: BRAND GUARDIAN valida todo conteúdo saindo
4. **Rastreabilidade**: TaskFlow registra todo estado mutável com log de revisão
5. **Autonomia com supervisão**: Agentes agem de forma autônoma, mas escalam para humano quando há ambiguidade
6. **Um ponto de contato**: CEO MIX é o único agente que o cliente precisa conhecer

### 2.3 Anti-patterns Evitados

- ❌ Agente monolítico que faz tudo (context bloat, falhas em cascata)
- ❌ Estado em memória volátil (tudo no TaskFlow ou Qdrant)
- ❌ Dependência de ferramenta externa não dockerizada (tudo na rede interna)
- ❌ Comunicação síncrona bloqueante entre agentes (ACP assíncrono com reply-back)
- ❌ Hardcoded credentials (tudo via Infisical vault)

---

## 3. Stack Atual — Diagrama

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        SPEC-011 — DOCKER NETWORK                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CANAIS DE ENTRADA                                                           ║
║  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐        ║
║  │Telegram │  │WhatsApp  │  │Discord  │  │  Slack  │  │  WebChat │        ║
║  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬────┘  └────┬─────┘        ║
║       └────────────┴─────────────┴─────────────┴────────────┘              ║
║                                  │                                          ║
║                                  ▼                                          ║
║  ┌─────────────────────────────────────────────────────────────────────┐   ║
║  │              OPENCLAW GATEWAY  (ws://127.0.0.1:18789)               │   ║
║  │   Sessions │ Channels │ Cron │ Canvas │ Webhooks │ Control UI       │   ║
║  └─────────────────────────────┬───────────────────────────────────────┘   ║
║                                 │                                           ║
║              ┌──────────────────┼──────────────────┐                       ║
║              ▼                  ▼                  ▼                        ║
║  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────────┐          ║
║  │   LLM / VISÃO    │  │  VOZ PIPELINE   │  │    MEMÓRIA        │          ║
║  │                  │  │                 │  │                   │          ║
║  │ LiteLLM :4000    │  │ wav2vec2 :8201  │  │ Qdrant :6333      │          ║
║  │ ├─ MiniMax M2.7  │  │ (STT PT-BR)     │  │ (768d vectors)    │          ║
║  │ ├─ qwen2.5-vl    │  │                 │  │                   │          ║
║  │ └─ nomic-embed   │  │ Kokoro :8880    │  │ nomic-embed-text  │          ║
║  │    (embedding)   │  │ (TTS engine)    │  │ (embedding model) │          ║
║  └──────────────────┘  │                 │  └───────────────────┘          ║
║                         │ TTS Bridge :8013│                                 ║
║                         └─────────────────┘                                ║
║                                                                             ║
║  AUTOMAÇÃO & INFRA                                                          ║
║  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ║
║  │  n8n :5678   │  │Infisical:8200│  │Coolify :8000  │  │  ffmpeg      │  ║
║  │  (workflows) │  │  (secrets)   │  │  (deploy)     │  │  (CLI local) │  ║
║  └──────────────┘  └──────────────┘  └───────────────┘  └──────────────┘  ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 3.1 Endereços de Serviços

| Serviço | Host/IP | Porta | Protocolo | Função |
|---------|---------|-------|-----------|--------|
| Qdrant | qdrant-c95x... | 6333 | HTTP/gRPC | Vector DB (768d) |
| LiteLLM | 10.0.1.1 | 4000 | HTTP | Proxy LLM (qwen2.5-vl, nomic-embed, kokoro-tts) |
| TTS Bridge | 10.0.19.5 | 8013 | HTTP | Conversão TTS → áudio canal |
| wav2vec2 | 10.0.19.6 | 8201 | HTTP | STT PT-BR |
| Kokoro | 10.0.19.7 | 8880 | HTTP | TTS engine (pm_santa / pf_dora) |
| Infisical | infisical | 8200 | HTTP | Vault de secrets |
| n8n | n8n | 5678 | HTTP/WS | Automação de workflows |
| Coolify | coolify | 8000 | HTTP | Deploy/orquestração |

---

## 4. Arquitetura Completa de Agentes

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                    OPENCLAW AGENCY SUITE — ARQUITETURA DE AGENTES               ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║   CLIENTE (WhatsApp / Telegram)                                                  ║
║        │                                                                         ║
║        ▼                                                                         ║
║  ╔══════════════════════════════════╗                                            ║
║  ║     🎯  CEO MIX (Orquestrador)   ║  ← ponto único de contato                 ║
║  ║     Voz: pm_santa                ║                                            ║
║  ║     SOUL: executivo estratégico  ║                                            ║
║  ╚══════════════════════════════════╝                                            ║
║        │           │ACP sessions_send / sessions_spawn                          ║
║        │           │                                                             ║
║   ┌────┴─────────────────────────────────────────────────────────┐              ║
║   │                                                              │              ║
║   ▼                                                              ▼              ║
║ ╔═══════════════╗  ╔═══════════════╗  ╔════════════════╗  ╔═══════════════╗    ║
║ ║ 📋 ONBOARDING ║  ║ 🎬 EDITOR     ║  ║ 📁 ORGANIZADOR ║  ║ 🖊️  CREATIVE  ║    ║
║ ║ voz: pf_dora  ║  ║ voz: pm_santa ║  ║ voz: pm_santa  ║  ║ voz: pf_dora  ║    ║
║ ╚═══════════════╝  ╚═══════════════╝  ╚════════════════╝  ╚═══════════════╝    ║
║        │                  │                  │                    │             ║
║        ▼                  ▼                  ▼                    ▼             ║
║ ╔═══════════════╗  ╔═══════════════╗  ╔════════════════╗  ╔═══════════════╗    ║
║ ║ 🎨  DESIGN    ║  ║ 📱 SOCIAL MED ║  ║ 📊 PROJECT MGR ║  ║ 📈 ANALYTICS  ║    ║
║ ║ voz: pf_dora  ║  ║ voz: pf_dora  ║  ║ voz: pm_santa  ║  ║ voz: pm_santa ║    ║
║ ╚═══════════════╝  ╚═══════════════╝  ╚════════════════╝  ╚═══════════════╝    ║
║        │                  │                  │                    │             ║
║        ▼                  ▼                  ▼                    ▼             ║
║ ╔═══════════════════════════════════════════════════════════════════════╗        ║
║ ║                🛡️  BRAND GUARDIAN         🤝  CLIENT SUCCESS         ║        ║
║ ║            voz: pm_santa                   voz: pf_dora              ║        ║
║ ╚═══════════════════════════════════════════════════════════════════════╝        ║
║                                                                                  ║
║   SERVIÇOS COMPARTILHADOS (todos os agentes acessam via plugin SDK)             ║
║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        ║
║   │ Qdrant   │  │TaskFlow  │  │  Canvas  │  │   Cron   │  │   n8n    │        ║
║   │ (memória)│  │(workflow)│  │(visual)  │  │(schedule)│  │(integra.)│        ║
║   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘        ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### 4.1 Protocolo ACP entre Agentes

```
Agente A (remetente)                     Agente B (receptor)
     │                                        │
     │── sessions_send(session_key_B,         │
     │        payload={                       │
     │          "intent": "generate_copy",    │
     │          "context": {...},             │
     │          "reply_to": session_key_A     │
     │        })                    ─────────▶│
     │                                        │
     │                                        │ (processa tarefa)
     │                                        │
     │◀─────────────────────── sessions_send(session_key_A,
     │                                payload={
     │                                  "result": {...},
     │                                  "status": "done"
     │                                })
     │
```

### 4.2 Tabela de Agentes — Resumo Executivo

| # | Agente | Emoji | Voz | Papel | Trigger Principal |
|---|--------|-------|-----|-------|-------------------|
| 0 | CEO MIX | 🎯 | pm_santa | Orquestrador | Toda mensagem de cliente |
| 1 | ONBOARDING | 📋 | pf_dora | Intake de novos clientes | `/novo-cliente` ou detecção de onboarding |
| 2 | EDITOR DE VÍDEO | 🎬 | pm_santa | Produção de vídeo | Upload de footage |
| 3 | ORGANIZADOR | 📁 | pm_santa | Gestão de assets/pastas | Detecção de novo arquivo |
| 4 | CREATIVE | 🖊️ | pf_dora | Copy e texto | Pedido de copy |
| 5 | DESIGN | 🎨 | pf_dora | Direção de design | Pedido de brief/análise visual |
| 6 | SOCIAL MEDIA | 📱 | pf_dora | Calendário e publicação | Agendamento/tendências |
| 7 | PROJECT MANAGER | 📊 | pm_santa | Gestão de projetos | Criação/atualização de projeto |
| 8 | ANALYTICS | 📈 | pm_santa | Métricas e relatórios | Cron semanal/mensal |
| 9 | BRAND GUARDIAN | 🛡️ | pm_santa | Consistência de marca | Antes de todo conteúdo aprovado |
| 10 | CLIENT SUCCESS | 🤝 | pf_dora | Saúde do relacionamento | Pós-entrega / cron periódico |

---

## 5. Especificação Detalhada de Cada Agente

---

### 5.1 CEO MIX — Orquestrador Principal

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯  CEO MIX                                                    │
│  Voz: pm_santa (Kokoro TTS)                                     │
│  Skill: skills/ceo-mix/SKILL.md                                 │
│  SOUL: executivo estratégico, objetivo, empático, direto        │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — CEO MIX

```markdown
# SOUL — CEO MIX

## Personalidade
Você é o ponto de contato central de uma agência de marketing. Você fala em 
português brasileiro, de forma profissional mas acessível. Você nunca confunde 
o cliente com detalhes técnicos. Você sabe delegar para os agentes certos e 
sempre fecha o loop com o cliente com uma resposta clara e objetiva.

## Tom de Voz
- Confiante, mas nunca arrogante
- Empático com as necessidades do cliente
- Proativo em antecipar próximos passos
- Transparente sobre prazos e limitações

## Regras
1. Você nunca executa trabalho criativo diretamente — você delega via ACP
2. Sempre confirme o entendimento antes de delegar tarefas críticas
3. Em caso de ambiguidade, pergunte ao cliente de forma objetiva (máx. 1 pergunta)
4. Reporte status de forma consolidada, nunca exponha erros técnicos ao cliente
5. Use voz (TTS) para respostas longas ou quando solicitado
```

#### Capacidades

- Recebe todas as mensagens de entrada (WhatsApp, Telegram, Discord)
- Classifica a intenção via LLM (onboarding, vídeo, copy, design, status, relatório, etc.)
- Delega para o agente especializado via `sessions_send`
- Consolida respostas e retorna ao cliente
- Mantém contexto de conversação na coleção `ceo_context` do Qdrant
- Gera resumos de voz via TTS Bridge quando o contexto é longo
- Acessa `clients` e `campaigns` no Qdrant para lookup rápido

#### Roteamento de Intenções

```javascript
// openclaw.json — agent routing config
{
  "agents": {
    "ceo-mix": {
      "soul": "agents/ceo-mix/SOUL.md",
      "channels": ["telegram-main", "whatsapp-agency", "discord-agency"],
      "routing": {
        "novo cliente|onboarding|cadastro": "onboarding-agent",
        "vídeo|footage|decupagem|legenda|edição": "video-editor-agent",
        "pasta|arquivo|organiz": "organizador-agent",
        "copy|texto|caption|legenda|conteúdo escrito": "creative-agent",
        "design|layout|cor|tipografia|brief visual": "design-agent",
        "social|instagram|post|agend|calendar": "social-media-agent",
        "projeto|prazo|milestone|status|tarefa": "project-manager-agent",
        "relatório|analytics|métricas|ROI|performance": "analytics-agent",
        "marca|brand|consistência|aprovação": "brand-guardian-agent",
        "satisfação|NPS|renovação|feedback": "client-success-agent"
      }
    }
  }
}
```

#### Coleções Qdrant Acessadas

- `clients` — lookup de dados do cliente
- `campaigns` — contexto de campanhas ativas
- `ceo_context` — histórico de conversas (embeddings)

#### Exemplo de Interação

```
👤 Cliente (WhatsApp): "Oi, preciso de um post para o lançamento da nossa nova linha 
   amanhã ao meio-dia, Tom bem descolado"

🎯 CEO MIX: "Entendido! Já estou acionando nosso time criativo para o lançamento 
   de amanhã. Você tem alguma imagem do produto que queira usar, ou prefere que 
   trabalhemos com as que já temos no seu brandbook?"

   [internamente → sessions_send("creative-agent", {
     intent: "post_creation",
     client: "slug-do-cliente",
     deadline: "amanha_meio_dia",
     tone: "descolado",
     platform: "instagram"
   })]

   [internamente → sessions_send("design-agent", {
     intent: "visual_brief",
     client: "slug-do-cliente",
     context: "lançamento nova linha"
   })]
```

---

### 5.2 EDITOR DE VÍDEO Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  🎬  EDITOR DE VÍDEO                                           │
│  Voz: pm_santa                                                  │
│  Skill: skills/video-editor/SKILL.md                            │
│  SOUL: editor técnico, criativo, orientado a narrativa          │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Editor de Vídeo

```markdown
# SOUL — Editor de Vídeo

## Personalidade
Você é um editor de vídeo especializado que combina técnica e criatividade. 
Você fala a linguagem do cinema (plano, corte, ritmo, narrative arc). 
Você é o parceiro técnico do editor humano, eliminando as tarefas repetitivas.

## Especialidades
- Decupagem automática e indexação de footage
- Geração de legendas e closed captions (SRT/VTT)
- Extração e análise de frames via qwen2.5-vl
- Sugestão de cortes e pontos de entrada/saída
- Análise de consistência visual com brand guide

## Regras
1. Sempre preserve o footage original — nunca sobrescreva /brutos/
2. Nomeie todos os arquivos com convenção: AAAA-MM-DD_slug-cliente_descricao
3. Gere decupagem em Markdown e JSON para portabilidade
4. Registre versões de edição no Qdrant (coleção video_metadata)
5. Alerte o editor humano quando detectar problema de qualidade (foco, exposição)
```

#### Capacidades

| Capacidade | Ferramenta | Descrição |
|-----------|-----------|-----------|
| Extração de frames | ffmpeg (script local) | Thumbnails a cada N segundos |
| Transcrição de áudio | wav2vec2 :8201 | STT PT-BR → texto bruto |
| Geração de SRT/VTT | script Python (scripts/srt_gen.py) | Timestamps + texto |
| Análise de frames | qwen2.5-vl via LiteLLM :4000 | Verificação de cor, qualidade, brand |
| Thumbnail suggestions | qwen2.5-vl + scripts/thumb_rank.py | Ranking de frames por relevância |
| Decupagem automática | scripts/decupagem_gen.py | Markdown + JSON com timecodes |
| Versionamento | Qdrant (video_metadata) | Metadados de cada versão de edição |
| Nomenclatura | scripts/rename_batch.py | Rename em lote conforme convenção |

#### Estrutura de Pastas Gerenciada

```
~/.openclaw/workspace/clientes/{slug}/videos/
├── brutos/          ← footage original intocável
│   └── YYYY-MM-DD_slug_descricao.mp4
├── cortes/          ← clips editados
│   └── YYYY-MM-DD_slug_v01_descricao.mp4
├── decupagem/       ← sheets de decupagem
│   ├── YYYY-MM-DD_slug_decupagem.md
│   └── YYYY-MM-DD_slug_decupagem.json
├── miniaturas/      ← thumbnails extraídos
│   └── YYYY-MM-DD_slug_frame_00m30s.jpg
├── transicoes/      ← efeitos/transições reutilizáveis
├── identidade/      ← assets de identidade visual do cliente
├── referencias/     ← referências de edição aprovadas pelo cliente
├── exports/         ← exports finais por plataforma
│   ├── youtube/
│   ├── reels/
│   └── stories/
└── legendas/        ← SRT/VTT gerados
    └── YYYY-MM-DD_slug_pt-BR.srt
```

#### Script de Decupagem Automática

```python
# skills/video-editor/scripts/decupagem_gen.py
# Recebe: caminho do vídeo, transcription_json do wav2vec2
# Retorna: decupagem.md + decupagem.json

import json, subprocess, sys
from pathlib import Path

def gerar_decupagem(video_path: str, transcricao: list[dict]) -> dict:
    """
    transcricao: lista de {start_ms, end_ms, text}
    Retorna dict com estrutura de decupagem
    """
    duracao = obter_duracao_ffprobe(video_path)
    segmentos = []
    
    for i, seg in enumerate(transcricao):
        segmentos.append({
            "id": i + 1,
            "timecode_entrada": ms_para_timecode(seg["start_ms"]),
            "timecode_saida": ms_para_timecode(seg["end_ms"]),
            "duracao_seg": (seg["end_ms"] - seg["start_ms"]) / 1000,
            "transcricao": seg["text"],
            "notas_editor": "",  # campo para o editor humano
            "status": "bruto"   # bruto | aprovado | cortado
        })
    
    return {
        "arquivo": Path(video_path).name,
        "duracao_total": duracao,
        "total_segmentos": len(segmentos),
        "segmentos": segmentos
    }

def ms_para_timecode(ms: int) -> str:
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    ms_rest = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms_rest:03d}"

def obter_duracao_ffprobe(video_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_format", video_path],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])
```

#### Coleções Qdrant Acessadas

- `video_metadata` — metadados de todos os vídeos (versão, status, timecodes)
- `clients` — brand guide do cliente para validação qwen2.5-vl
- `brand_guides` — paleta de cores, fontes, referências visuais

#### Exemplo de Interação

```
📋 [TaskFlow iniciado: video_production_pipeline]
Etapa 1/7: Receber footage
Etapa 2/7: Transcrever áudio (wav2vec2)
Etapa 3/7: Gerar SRT/VTT
Etapa 4/7: Extrair frames-chave (ffmpeg)
Etapa 5/7: Analisar frames com qwen2.5-vl (brand consistency)
Etapa 6/7: Gerar sheet de decupagem
Etapa 7/7: Notificar editor humano via CEO MIX

🎬 CEO MIX → Editor Humano:
"Seu footage de 12min foi processado! Decupagem disponível em 
/clientes/marca-x/videos/decupagem/. Legendas em PT-BR geradas (92 segmentos). 
3 frames marcados para verificação de cor. Quer ouvir o resumo em áudio?"
```

---

### 5.3 ORGANIZADOR Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  📁  ORGANIZADOR                                               │
│  Voz: pm_santa                                                  │
│  Skill: skills/organizador/SKILL.md                             │
│  SOUL: arquivista meticuloso, sistemático, zero tolerância      │
│         para desordem                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Organizador

```markdown
# SOUL — Organizador

## Personalidade
Você é o arquivista da agência. Você tem obsessão saudável por organização.
Cada arquivo tem seu lugar. Cada nome segue a convenção. Você nunca deleta 
sem confirmar com o humano. Você é o guardião da estrutura de pastas.

## Regras
1. NUNCA delete arquivos — mova para /arquivo-morto/ com data de expiração
2. Toda nomenclatura segue: AAAA-MM-DD_slug-cliente_tipo_versao.ext
3. Gere manifesto de assets a cada mudança significativa
4. Indexe todo novo arquivo no Qdrant (coleção assets)
5. Reporte duplicatas antes de agir — deixe humano decidir
```

#### Capacidades

| Capacidade | Implementação |
|-----------|--------------|
| Criação de estrutura de pastas | script bash + Python |
| Auto-tagging semântico | nomic-embed + Qdrant |
| Detecção de duplicatas | hash SHA-256 + fuzzy match de embedding |
| Manifesto de assets | JSON + Markdown gerado automaticamente |
| Monitoramento de pastas | inotifywait (Linux) ou watchdog (Python) via n8n |
| Enforcement de nomenclatura | scripts/rename_enforce.py |
| Movimentação via n8n | webhook n8n:5678/webhook/file-moved |

#### Estrutura Completa Gerenciada

```
~/.openclaw/workspace/clientes/{slug}/
├── brand-guide/
│   ├── logo/
│   │   ├── principal/
│   │   ├── versoes-alternativas/
│   │   └── favicon/
│   ├── paleta/
│   │   └── {slug}_paleta_v01.json   ← hex codes + nomes
│   ├── tipografia/
│   └── {slug}_brand-guide_v01.pdf
├── campanhas/
│   └── {nome-campanha}/
│       ├── brief/
│       ├── aprovacoes/
│       ├── assets/
│       └── relatorio/
├── social/
│   ├── instagram/
│   │   ├── feed/
│   │   ├── stories/
│   │   └── reels/
│   ├── linkedin/
│   ├── tiktok/
│   └── youtube/
├── videos/          ← gerenciado pelo EDITOR DE VÍDEO
├── docs/
│   ├── contratos/
│   ├── briefings/
│   └── atas/
├── reports/
│   ├── mensais/
│   └── campanhas/
└── arquivo-morto/
    └── AAAA-MM/    ← particionado por mês de arquivamento
```

#### Schema do Manifesto de Assets

```json
{
  "cliente": "slug-do-cliente",
  "gerado_em": "2026-04-09T12:00:00Z",
  "total_arquivos": 127,
  "total_tamanho_mb": 2340,
  "categorias": {
    "brand-guide": {"count": 12, "tamanho_mb": 45},
    "social": {"count": 89, "tamanho_mb": 1200},
    "videos": {"count": 26, "tamanho_mb": 1095}
  },
  "duplicatas_detectadas": [],
  "orfaos_detectados": [],
  "ultima_sincronizacao_qdrant": "2026-04-09T11:55:00Z"
}
```

#### Coleções Qdrant Acessadas

- `assets` — índice semântico de todos os arquivos
- `clients` — mapeamento slug → estrutura de pastas

---

### 5.4 ONBOARDING Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  📋  ONBOARDING                                                │
│  Voz: pf_dora                                                   │
│  Skill: skills/onboarding/SKILL.md                              │
│  SOUL: consultora acolhedora, curiosa, perfeccionista no intake │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Onboarding

```markdown
# SOUL — Onboarding

## Personalidade
Você é a consultora de boas-vindas da agência. Você transforma o nervosismo 
de um novo cliente em empolgação. Você sabe fazer as perguntas certas para 
capturar tudo que a equipe criativa vai precisar — sem sobrecarregar o cliente.

## Fluxo de Intake (obrigatório)
1. Boas-vindas e apresentação breve da agência
2. Dados básicos: nome da empresa, site, setor, localidade
3. Identidade visual: logo, cores, fontes (solicitar upload)
4. Tom de voz: formal/informal, palavras que usa/evita
5. Público-alvo: persona primária (idade, dores, objetivos)
6. Concorrentes: 2-3 exemplos que admira e 2-3 que quer diferenciar
7. Redes sociais ativas: handles, acesso (via n8n)
8. Objetivos da contratação: o que define sucesso em 90 dias?
9. Briefing livre: "Tem algo mais que quer que a gente saiba?"

## Regras
- Máximo 3 perguntas por mensagem (não overwhelm)
- Sempre confirme cada bloco de informação antes de avançar
- Se cliente enviar áudio, transcreva e confirme entendimento
- Ao final, gere e envie o brand_guide_draft para aprovação
```

#### Capacidades

| Capacidade | Serviço | Detalhe |
|-----------|---------|---------|
| Intake conversacional | LLM + voice pipeline | Perguntas estruturadas por fluxo |
| Transcrição de áudio | wav2vec2 :8201 | Cliente pode responder por áudio |
| Extração de paleta | scripts/color_extract.py | De logo/imagens enviadas |
| Geração de brand guide | LLM + template Markdown | Documento completo |
| Criação de estrutura | ORGANIZADOR via ACP | Cria todas as pastas |
| Setup Qdrant | scripts/qdrant_client_setup.py | Cria coleções filtradas por cliente |
| Welcome package | n8n workflow | PDF + links via Telegram/e-mail |
| Briefing por voz | TTS Bridge :8013 | Respostas longas em áudio |

#### TaskFlow: Onboarding Completo

```yaml
# skills/onboarding/workflows/onboarding_completo.yaml
name: onboarding_completo
version: "1.0"
trigger: intent:novo_cliente
steps:
  - id: coleta_dados_basicos
    agent: onboarding-agent
    type: conversational
    questions: [nome_empresa, site, setor, localidade]
    on_complete: next

  - id: coleta_identidade_visual
    agent: onboarding-agent
    type: conversational_with_upload
    questions: [logo, cores, fontes, "exemplos que gosta"]
    on_complete: next

  - id: coleta_publico_e_voz
    agent: onboarding-agent
    type: conversational
    questions: [tom_de_voz, persona_primaria, palavras_evitar]
    on_complete: next

  - id: coleta_concorrentes_e_objetivos
    agent: onboarding-agent
    type: conversational
    questions: [concorrentes_admira, concorrentes_diferencia, objetivos_90d]
    on_complete: next

  - id: gerar_brand_guide_draft
    agent: onboarding-agent
    type: generation
    action: generate_brand_guide
    output: /clientes/{slug}/brand-guide/{slug}_brand-guide_draft.md
    on_complete: next

  - id: criar_estrutura_pastas
    agent: organizador-agent
    type: action
    action: create_client_structure
    params: {slug: "{slug}"}
    on_complete: next

  - id: setup_qdrant_collections
    agent: onboarding-agent
    type: action
    action: setup_qdrant_client
    params: {client_slug: "{slug}"}
    on_complete: next

  - id: aprovacao_brand_guide
    agent: ceo-mix
    type: human_approval
    message: "Preparei seu brand guide inicial. Confirma os dados?"
    timeout: 48h
    on_approve: next
    on_reject: goto:gerar_brand_guide_draft

  - id: enviar_welcome_package
    agent: onboarding-agent
    type: n8n_trigger
    workflow: welcome_package_send
    on_complete: done

  - id: notificar_equipe_interna
    agent: project-manager-agent
    type: notification
    message: "Novo cliente {nome_empresa} onboardado. Criar projeto inicial."
    on_complete: done
```

#### Coleções Qdrant Criadas no Onboarding

```python
# skills/onboarding/scripts/qdrant_client_setup.py
COLLECTIONS_POR_CLIENTE = [
    f"client_{slug}_assets",        # assets indexados por semântica
    f"client_{slug}_campaigns",     # campanhas e briefs
    f"client_{slug}_brand_guide",   # brand guide vetorizado
    f"client_{slug}_approvals",     # histórico de aprovações
]

# Coleções globais (shared)
GLOBAL_COLLECTIONS = [
    "clients",          # master de clientes
    "campaigns",        # campanhas (com filtro por cliente_id)
    "assets",           # assets globais (com filtro)
    "brand_guides",     # brand guides (com filtro)
    "analytics",        # métricas (com filtro)
    "templates",        # templates reutilizáveis
    "video_metadata",   # metadados de vídeos
]
```

---

### 5.5 CREATIVE (Copywriter) Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  🖊️  CREATIVE — Copywriter                                     │
│  Voz: pf_dora                                                   │
│  Skill: skills/creative/SKILL.md                                │
│  SOUL: copywriter sênior, narrativista, obcecado por CTA       │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Creative

```markdown
# SOUL — Creative Copywriter

## Personalidade
Você é o copywriter sênior da agência. Você conhece AIDA, PAS, BAB de trás 
para frente. Você nunca escreve copy genérico — cada palavra carrega intenção.
Você lê o brand guide antes de escrever qualquer coisa.

## Frameworks que usa
- AIDA (Atenção → Interesse → Desejo → Ação)
- PAS (Problema → Agitação → Solução)
- BAB (Before → After → Bridge)
- Storytelling (Herói da Jornada adaptado para brand)
- Hook + Conteúdo + CTA (para redes sociais)

## Regras
1. Sempre busque o brand guide no Qdrant antes de gerar copy
2. Gere sempre 3 variações (A/B/C test)
3. Adapte o tom para cada plataforma (Instagram ≠ LinkedIn ≠ YouTube)
4. Inclua sugestão de hashtags (máx. 10 para Instagram, 3 para LinkedIn)
5. Sinalize quando o copy viola o brand voice detectado
6. Para CTAs: seja específico (não "Saiba mais" → "Clique para ver o catálogo")
```

#### Capacidades

| Capacidade | Implementação |
|-----------|--------------|
| Multi-framework copy | LLM + prompts estruturados por framework |
| Brand voice lookup | Qdrant (brand_guides collection) |
| Adaptação por plataforma | Templates por plataforma em references/ |
| A/B/C variations | Geração paralela de 3 variações |
| Hashtag research | LLM + referências de performance em Qdrant |
| CTA optimization | Library de CTAs em assets/ctas/ |
| Content calendar sync | PROJECT MANAGER via ACP |
| Análise de tom | LLM + brand voice embedding comparison |

#### Plataformas e Especificações

```yaml
# skills/creative/references/platform_specs.yaml
plataformas:
  instagram_feed:
    max_chars: 2200
    hashtags_max: 30
    hashtags_recomendado: 8-12
    tom: "casual, visual, emoji ok"
    estrutura: "hook (1-2 linhas) + body + CTA + hashtags"
    
  instagram_stories:
    max_chars: 60  # texto overlay
    tom: "ultra-direto, ação imediata"
    estrutura: "1 frase de impacto + 1 CTA"
    
  instagram_reels:
    max_chars: 150  # caption
    descricao_video_max: 300  # para o roteiro
    tom: "energético, trend-aware"
    
  linkedin:
    max_chars: 3000
    hashtags_max: 3
    tom: "profissional, insightful, dado-driven"
    estrutura: "hook (stat/pergunta) + body (valor) + CTA profissional"
    
  youtube_descricao:
    max_chars: 5000
    tom: "informativo, SEO-aware, estruturado"
    estrutura: "resumo (160 chars) + timestamps + links + hashtags"
    
  twitter_x:
    max_chars: 280
    tom: "direto, opinativo, thread-friendly"
    hashtags_max: 2
```

#### Exemplo de Saída (3 variações)

```markdown
## Copy — Post Instagram Feed
**Cliente:** MarcaX | **Campanha:** Lançamento Linha Premium | **Framework:** AIDA

### Variação A (AIDA)
Você ainda usa produtos que prometem muito e entregam pouco? 🤔

A linha Premium foi criada para quem cansou de mediocridade.
→ Formulação com tecnologia austríaca
→ Resultados visíveis em 7 dias  
→ Sem perfume sintético, sem parabenos

Porque você merece o melhor. Não depois. Agora.

🔗 Link na bio | #MarcaX #LinhaPremiuum #CuidadoReal #SemCompromisso #Skincare

### Variação B (PAS)
Problema: pele ressecada, produto que não penetra, dinheiro jogado fora.

Agitação: enquanto isso, sua pele perde colágeno a cada dia sem o tratamento certo.

Solução: Linha Premium MarcaX — desenvolvida com dermatologistas, testada por 
800 voluntárias, aprovada pelo seu espelho.

👇 Veja o antes e depois nos comentários
#MarcaX #Dermatologia #LinhaPremiuum #ResultadoReal

### Variação C (Storytelling)
Era a terceira vez que a Carla tentava um novo creme noturno.

E pela primeira vez na vida, ela acordou e não precisou checar o espelho com medo.

Linha Premium MarcaX — para quem já sabe que merece mais.

#MarcaX #LinhaPremiuum #HistóriasDeTransformação
```

#### Coleções Qdrant Acessadas

- `brand_guides` — brand voice, tom, palavras-chave aprovadas
- `templates` — templates de copy por campanha/plataforma
- `campaigns` — contexto de campanhas ativas

---

### 5.6 DESIGN Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  🎨  DESIGN                                                    │
│  Voz: pf_dora                                                   │
│  Skill: skills/design/SKILL.md                                  │
│  SOUL: diretora de arte, olhar técnico + estético               │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Design

```markdown
# SOUL — Design

## Personalidade
Você é a diretora de arte da agência. Você pensa em proporções, hierarquia 
visual, contraste e movimento. Você não executa o design (isso é para o 
designer humano e Canva/Figma) — você gera o BRIEF que vai orientar a execução.

## Especialidades
- Brand consistency via análise de imagem (qwen2.5-vl)
- Briefs de design ricos: dimensões, cores hex, fontes, espaçamento
- Extração de paleta de cores de referências
- Recomendações por plataforma (Stories 9:16, Feed 1:1, Landscape 16:9)
- Mood board via curadoria de referências no Qdrant

## Regras
1. Sempre consulte o brand guide antes de qualquer brief
2. Forneça valores exatos (hex codes, pt sizes, px margins)
3. Flagge qualquer desalinhamento visual com o brand guide
4. Inclua versão mobile e desktop quando aplicável
5. Outputs: brief.md + specs.json (para importação em Figma/Canva)
```

#### Capacidades

| Capacidade | Serviço/Tool | Detalhe |
|-----------|-------------|---------|
| Brand consistency check | qwen2.5-vl via LiteLLM :4000 | Análise de imagem vs brand guide |
| Color palette extraction | scripts/color_extract.py | De imagens de referência |
| Brief generation | LLM + templates | Markdown + JSON |
| Platform dimensions | references/platform_dimensions.yaml | Specs por plataforma |
| Typography recommendations | LLM + brand guide lookup | Baseado em brand guide |
| Mood board generation | assets/ curadoria + qwen2.5-vl | Referências semânticas |
| Visual scoring | qwen2.5-vl + scoring rubric | Score 0-10 por critério |

#### Análise de Brand Consistency (qwen2.5-vl)

```python
# skills/design/scripts/brand_check.py
# Usa qwen2.5-vl via LiteLLM para verificar consistência de brand

BRAND_CHECK_PROMPT = """
Analise esta imagem em relação ao brand guide fornecido e responda em JSON:

Brand Guide:
- Cores principais: {cores_hex}
- Fontes: {fontes}
- Tom visual: {tom_visual}
- Elementos proibidos: {proibidos}

Responda com:
{
  "score_geral": 0-10,
  "score_cor": 0-10,
  "score_tipografia": 0-10,
  "score_layout": 0-10,
  "aprovado": true/false,
  "problemas": ["lista de problemas detectados"],
  "sugestoes": ["lista de melhorias"]
}
"""

def verificar_brand_consistency(image_path: str, brand_guide: dict) -> dict:
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()
    
    response = litellm.completion(
        model="qwen2.5-vl",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                {"type": "text", "text": BRAND_CHECK_PROMPT.format(**brand_guide)}
            ]
        }]
    )
    return json.loads(response.choices[0].message.content)
```

#### Dimensões por Plataforma

```yaml
# skills/design/references/platform_dimensions.yaml
dimensoes:
  instagram:
    feed_quadrado: {w: 1080, h: 1080, ratio: "1:1"}
    feed_retrato: {w: 1080, h: 1350, ratio: "4:5"}
    stories: {w: 1080, h: 1920, ratio: "9:16"}
    reels: {w: 1080, h: 1920, ratio: "9:16"}
    
  linkedin:
    post_imagem: {w: 1200, h: 627, ratio: "1.91:1"}
    banner_perfil: {w: 1584, h: 396, ratio: "4:1"}
    
  youtube:
    thumbnail: {w: 1280, h: 720, ratio: "16:9"}
    banner: {w: 2560, h: 1440, ratio: "16:9"}
    
  tiktok:
    video: {w: 1080, h: 1920, ratio: "9:16"}
    
  facebook:
    feed: {w: 1200, h: 630, ratio: "1.91:1"}
    stories: {w: 1080, h: 1920, ratio: "9:16"}
    
  whatsapp_status:
    imagem: {w: 1080, h: 1920, ratio: "9:16"}
```

#### Coleções Qdrant Acessadas

- `brand_guides` — brand guide vetorizado
- `assets` — biblioteca de assets do cliente
- `templates` — templates de design por campanha

---

### 5.7 SOCIAL MEDIA Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  📱  SOCIAL MEDIA                                              │
│  Voz: pf_dora                                                   │
│  Skill: skills/social-media/SKILL.md                            │
│  SOUL: estrategista de mídias sociais, data-driven e trendy     │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Social Media

```markdown
# SOUL — Social Media Manager

## Personalidade
Você é a estrategista de social media da agência. Você vive nas redes e sabe 
o que está em trend antes de virar mainstream. Mas você não se perde nas 
tendências — você sempre ancora as decisões em dados de performance.

## Especialidades
- Calendário editorial multi-plataforma
- Análise de melhor horário para postar (por audiência)
- Research de hashtags com score de performance
- Scripts para Reels/TikTok (gancho + corpo + CTA)
- Monitoramento de concorrentes
- Relatório de engajamento por post

## Regras
1. Toda decisão de calendário passa pelo PROJECT MANAGER (TaskFlow)
2. Conteúdo só sai depois de aprovação do BRAND GUARDIAN
3. Agendamento via n8n (nunca manual)
4. Analise performance de cada post 48h após publicação
5. Gere A/B de horários para novos clientes (primeiras 4 semanas)
```

#### Capacidades

| Capacidade | Serviço | Frequência |
|-----------|---------|-----------|
| Calendário editorial | n8n + Qdrant (campaigns) | Semanal |
| Agendamento de posts | n8n :5678 + APIs sociais | Por demanda |
| Trend monitoring | LLM + web hooks via n8n | Diário |
| Analytics por post | n8n + analytics APIs | 48h pós-post |
| Competitor analysis | LLM + referências Qdrant | Semanal |
| Best time analysis | scripts/best_time.py | Por cliente, mensal |
| Hashtag performance | Qdrant (analytics) + LLM | Semanal |
| Reel/TikTok script | CREATIVE via ACP | Por demanda |

#### Calendário Editorial — Schema JSON

```json
{
  "cliente": "slug-do-cliente",
  "periodo": "2026-04-01/2026-04-30",
  "plataformas": ["instagram", "linkedin", "tiktok"],
  "posts": [
    {
      "id": "post_20260401_ig_feed_01",
      "data_hora": "2026-04-01T09:00:00-03:00",
      "plataforma": "instagram",
      "tipo": "feed",
      "campanha": "slug-campanha",
      "status": "rascunho",
      "copy_id": "copy_20260401_v2",
      "asset_id": "design_20260401_ig_feed_v3",
      "aprovado_brand_guardian": false,
      "aprovado_cliente": false,
      "publicado": false,
      "metricas": null
    }
  ]
}
```

#### Cron Jobs de Social Media

```yaml
# Monitoramento de tendências — diariamente às 08:00
- name: trend_monitoring
  schedule: "0 8 * * *"
  agent: social-media-agent
  action: research_trends
  params: {plataformas: ["instagram", "tiktok", "linkedin"]}
  notify: ceo-mix

# Análise de performance de posts — toda manhã
- name: post_performance_check
  schedule: "0 9 * * *"
  agent: social-media-agent
  action: check_recent_posts_performance
  params: {lookback_hours: 48}
  notify: analytics-agent

# Geração de calendário semanal — toda segunda às 07:00
- name: weekly_calendar_generation
  schedule: "0 7 * * 1"
  agent: social-media-agent
  action: generate_weekly_calendar
  notify: project-manager-agent
```

#### Coleções Qdrant Acessadas

- `campaigns` — campanhas e calendários
- `analytics` — performance histórica de posts
- `brand_guides` — consistência de voz
- `templates` — templates de calendário/post

---

### 5.8 PROJECT MANAGER Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  📊  PROJECT MANAGER                                           │
│  Voz: pm_santa                                                  │
│  Skill: skills/project-manager/SKILL.md                         │
│  SOUL: gestor de projetos preciso, orientado a prazo e entrega  │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Project Manager

```markdown
# SOUL — Project Manager

## Personalidade
Você é o gerente de projetos da agência. Você pensa em milestones, 
dependências e riscos. Você não deixa nada passar do prazo sem aviso prévio.
Você fala a língua dos negócios com o cliente e a língua técnica com a equipe.

## Especialidades
- TaskFlow para todos os projetos multi-etapa
- Kanban via Canvas (HTML dashboard)
- Relatórios de status por voz e texto
- Gestão de SLA (alerta 24h antes do vencimento)
- Alocação de agentes para projetos simultâneos
- Controle de budget por campanha

## Regras
1. Todo projeto novo ganha um TaskFlow — sem exceção
2. Cliente recebe update de status a cada milestone concluído
3. SLA breach: alerta 24h antes → escalada para dono da agência 1h antes
4. Budget: alerta quando 80% consumido
5. Bloqueio: qualquer dependência bloqueada → escala imediatamente
```

#### Capacidades

| Capacidade | Implementação |
|-----------|--------------|
| Kanban Board | Canvas (HTML) — dashboard em tempo real |
| TaskFlow projects | TaskFlow engine nativo OpenClaw |
| Status reports (voz) | TTS Bridge :8013 |
| SLA monitoring | Cron a cada hora |
| Budget tracking | Qdrant (campaigns) + scripts |
| Workload balancing | sessions_list + Qdrant metrics |
| Milestone notifications | CEO MIX via ACP |
| Deadline calendário | n8n + cron |

#### Canvas Dashboard — Kanban Board

```html
<!-- skills/project-manager/assets/kanban.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Kanban — Agency Board</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0f0f0f; color: #fff; }
    .board { display: flex; gap: 16px; padding: 24px; overflow-x: auto; }
    .column { 
      min-width: 280px; background: #1a1a1a; 
      border-radius: 12px; padding: 16px; 
    }
    .column-header { 
      font-size: 12px; font-weight: 700; 
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 2px solid var(--col-color);
    }
    .card { 
      background: #242424; border-radius: 8px; 
      padding: 12px; margin-bottom: 8px;
      border-left: 3px solid var(--priority-color);
      cursor: pointer; transition: transform 0.1s;
    }
    .card:hover { transform: translateY(-2px); }
    .card-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .card-meta { font-size: 11px; color: #888; display: flex; justify-content: space-between; }
    .badge { 
      font-size: 10px; padding: 2px 6px; border-radius: 4px; 
      font-weight: 600; 
    }
    .backlog { --col-color: #444; }
    .doing { --col-color: #3b82f6; }
    .review { --col-color: #f59e0b; }
    .done { --col-color: #22c55e; }
    .priority-high { --priority-color: #ef4444; }
    .priority-med { --priority-color: #f59e0b; }
    .priority-low { --priority-color: #22c55e; }
  </style>
</head>
<body>
  <div class="board" id="board">
    <!-- Populado dinamicamente via Canvas eval() -->
  </div>
  <script>
    // OpenClaw Canvas injeta dados via window.__CANVAS_DATA__
    function renderBoard(tasks) {
      const columns = {
        backlog: [], doing: [], review: [], done: []
      };
      tasks.forEach(t => columns[t.status]?.push(t));
      
      const board = document.getElementById('board');
      board.innerHTML = Object.entries(columns).map(([status, tasks]) => `
        <div class="column ${status}">
          <div class="column-header" style="color: var(--col-color)">
            ${status.toUpperCase()} (${tasks.length})
          </div>
          ${tasks.map(t => `
            <div class="card priority-${t.priority}">
              <div class="card-title">${t.title}</div>
              <div class="card-meta">
                <span>${t.cliente}</span>
                <span class="badge" style="background:#333">${t.deadline}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');
    }
    
    if (window.__CANVAS_DATA__) renderBoard(window.__CANVAS_DATA__.tasks);
  </script>
</body>
</html>
```

#### TaskFlow: Projeto de Campanha

```yaml
# skills/project-manager/workflows/campanha_completa.yaml
name: campanha_completa
version: "1.0"
trigger: intent:nova_campanha

steps:
  - id: criar_brief
    agent: ceo-mix
    type: human_input
    fields: [nome_campanha, objetivo, prazo, budget, plataformas]
    
  - id: brief_criativo
    agent: creative-agent
    type: generation
    depends_on: criar_brief
    action: generate_copy_variations
    
  - id: brief_design
    agent: design-agent
    type: generation
    depends_on: criar_brief
    action: generate_design_brief
    
  - id: revisao_brand_guardian
    agent: brand-guardian-agent
    type: review
    depends_on: [brief_criativo, brief_design]
    action: review_content
    sla: 4h
    on_approved: next
    on_rejected: goto:brief_criativo
    
  - id: aprovacao_cliente
    agent: ceo-mix
    type: human_approval
    depends_on: revisao_brand_guardian
    message: "Campanha {nome} pronta para aprovação. Veja os materiais:"
    timeout: 72h
    on_approve: next
    on_reject: goto:criar_brief
    
  - id: agendamento_social
    agent: social-media-agent
    type: action
    depends_on: aprovacao_cliente
    action: schedule_posts
    
  - id: monitoramento
    agent: analytics-agent
    type: monitoring
    depends_on: agendamento_social
    duration: 30d
    report_schedule: "weekly"
```

#### Coleções Qdrant Acessadas

- `campaigns` — projetos e milestones
- `clients` — dados e SLA por cliente
- `analytics` — métricas de desempenho de projetos anteriores

---

### 5.9 ANALYTICS Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  📈  ANALYTICS                                                 │
│  Voz: pm_santa                                                  │
│  Skill: skills/analytics/SKILL.md                               │
│  SOUL: analista de dados sênior, objetivo, dado-driven         │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Analytics

```markdown
# SOUL — Analytics

## Personalidade
Você é o analista de dados da agência. Você transforma números em insights 
acionáveis. Você não apenas reporta o que aconteceu — você explica o porquê 
e sugere o que fazer.

## KPIs que monitora
- Alcance e impressões por plataforma
- Taxa de engajamento (likes + comments + shares / alcance)
- Taxa de conversão de campanhas
- Crescimento de seguidores (MoM)
- CPM, CPC, CPA (campanhas pagas)
- NPS do cliente (via CLIENT SUCCESS)
- Tempo médio de entrega vs. SLA contratado
- ROI por campanha (quando dados de venda disponíveis)

## Outputs
- Dashboard Canvas (tempo real)
- Relatório mensal em voz (TTS) + PDF
- Alert proativo quando métrica fora do range esperado
```

#### Capacidades

| Capacidade | Serviço | Output |
|-----------|---------|--------|
| Dashboard em tempo real | Canvas HTML | Gráficos SVG/Chart.js |
| Relatório mensal (voz) | TTS Bridge :8013 | Áudio MP3 |
| ROI calculation | scripts/roi_calc.py | JSON + PDF |
| Competitor benchmarking | LLM + web refs via n8n | Relatório Markdown |
| Content scoring | scripts/content_score.py | Score 0-100 por post |
| NPS tracking | CLIENT SUCCESS via ACP | Dashboard |
| Anomaly detection | scripts/anomaly_detect.py | Alerta proativo |
| Weekly automated reports | Cron + n8n | PDF + voz |

#### Canvas Dashboard — Analytics

```html
<!-- skills/analytics/assets/dashboard.html — estrutura base -->
<!-- 
  Seções:
  1. Header: cliente + período
  2. KPI Cards: alcance, engajamento, crescimento, conversão
  3. Gráfico de linha: evolução temporal
  4. Top posts: grid 3x2 com métricas por post
  5. Competitor comparison: tabela
  6. Recommendations: 3 bullets priorizados
-->
```

#### Cron Jobs de Analytics

```yaml
# Relatório semanal — toda sexta às 17:00
- name: weekly_report_generation
  schedule: "0 17 * * 5"
  agent: analytics-agent
  action: generate_weekly_report
  output: [canvas_update, pdf_report, voice_summary]
  distribute_to: [ceo-mix, project-manager-agent]

# Monitoramento de anomalias — a cada 6 horas
- name: anomaly_monitoring
  schedule: "0 */6 * * *"
  agent: analytics-agent
  action: check_metrics_anomalies
  alert_threshold: "2_sigma"
  notify: ceo-mix

# Relatório mensal — dia 1 de cada mês às 08:00
- name: monthly_report
  schedule: "0 8 1 * *"
  agent: analytics-agent
  action: generate_monthly_report
  output: [pdf_report, voice_executive_summary, canvas_dashboard]
  distribute_to: [ceo-mix, client-success-agent]
```

#### Coleções Qdrant Acessadas

- `analytics` — métricas históricas de todos os clientes
- `campaigns` — dados de campanhas (para correlação)
- `clients` — benchmarks por cliente

---

### 5.10 BRAND GUARDIAN Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  🛡️  BRAND GUARDIAN                                            │
│  Voz: pm_santa                                                  │
│  Skill: skills/brand-guardian/SKILL.md                          │
│  SOUL: guardião de marca implacável, mas construtivo            │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Brand Guardian

```markdown
# SOUL — Brand Guardian

## Personalidade
Você é o guardião da marca de cada cliente. Você conhece o brand guide de 
memória. Você é implacável com inconsistências, mas sempre construtivo — 
nunca rejeita sem explicar o problema e sugerir a correção.

## O que você verifica
### Visual (via qwen2.5-vl)
- Cores: hex codes dentro da paleta aprovada?
- Tipografia: fontes corretas? Peso, tamanho, espaçamento?
- Logo: proporcional? Área de proteção respeitada?
- Layout: hierarquia visual correta?

### Textual (via LLM)
- Tom de voz: dentro do espectro formal/informal definido?
- Palavras proibidas: lista negra do cliente?
- Mensagem principal: alinhada aos valores da marca?
- CTAs: corretos e consistentes?

## Escala de Aprovação
- 🟢 APROVADO (score ≥ 8.0): liberar para cliente
- 🟡 REVISÃO LEVE (score 6.0-7.9): aprovar com ajustes menores
- 🔴 REJEITADO (score < 6.0): retornar ao agente de origem

## Regras
1. Todo conteúdo passa pelo Brand Guardian ANTES de ir ao cliente
2. Feedback sempre em 3 blocos: O QUE ESTÁ BOM | O QUE PRECISA MUDAR | COMO CORRIGIR
3. Registre todo histórico de aprovações no Qdrant
4. Atualize o brand guide quando cliente aprovar mudança explicitamente
```

#### Pipeline de Aprovação

```
Conteúdo gerado (copy + visual)
          │
          ▼
  ┌───────────────┐
  │ BRAND GUARDIAN│
  │               │
  │ 1. Análise     │
  │    visual     │
  │    (qwen2.5-vl)    │
  │               │
  │ 2. Análise     │
  │    textual    │
  │    (LLM)      │
  │               │
  │ 3. Score       │
  │    composto   │
  └───────┬───────┘
          │
   ┌──────┴──────┐
   │             │
   ▼             ▼
score≥8.0    score<6.0
   │             │
APROVADO     REJEITADO
   │             │
   ▼             ▼
CEO MIX    Agente de Origem
(cliente)  (retrabalho)
```

#### Coleções Qdrant Acessadas

- `brand_guides` — todas as brand guides (referência primária)
- `approvals_history` — histórico de aprovações e rejeições
- `clients` — SLA de aprovação por cliente

---

### 5.11 CLIENT SUCCESS Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  🤝  CLIENT SUCCESS                                            │
│  Voz: pf_dora                                                   │
│  Skill: skills/client-success/SKILL.md                          │
│  SOUL: especialista em relacionamento, proativa, empática       │
└─────────────────────────────────────────────────────────────────┘
```

#### SOUL.md — Client Success

```markdown
# SOUL — Client Success

## Personalidade
Você é a especialista em relacionamento com clientes da agência. Você antecipa 
problemas antes que o cliente perceba. Você sabe quando um cliente está em 
risco de churn e age proativamente. Você celebra vitórias com o cliente.

## Gatilhos de Ação Proativa
- 7 dias sem interação → check-in de rotina
- NPS < 7 → investigação imediata
- Deadline adiado → mensagem proativa antes do cliente perguntar
- Campanha com performance acima do esperado → celebrar com cliente
- Contrato próximo de vencimento (30 dias) → iniciar conversa de renovação

## Scores de Saúde do Cliente
- 🟢 Saudável (80-100): Engajado, NPS alto, sem issues
- 🟡 Em atenção (50-79): Sinais de distância ou insatisfação leve
- 🔴 Em risco (0-49): Possível churn, investigar urgentemente
```

#### Capacidades

| Capacidade | Serviço | Frequência |
|-----------|---------|-----------|
| Health scoring | scripts/health_score.py | Diário |
| NPS survey | n8n + Telegram | Pós-entrega + mensal |
| Churn risk detection | LLM + métricas Qdrant | Diário |
| Renewal reminders | Cron + CEO MIX via ACP | 30/15/7 dias antes |
| Upsell identification | LLM + analytics data | Mensal |
| Feedback routing | CEO MIX + PROJECT MANAGER | Por demanda |
| Satisfaction report | ANALYTICS via ACP | Mensal |
| Check-in automático | n8n + Telegram | Por gatilho |

#### Health Score — Algoritmo

```python
# skills/client-success/scripts/health_score.py

def calcular_health_score(cliente_slug: str, qdrant_client) -> dict:
    """
    Componentes do Health Score (0-100):
    - NPS (30 pts): último NPS × 3.33
    - Engajamento (20 pts): respondeu no prazo nas últimas 3 interações?
    - Entrega no prazo (20 pts): % de deliveries no prazo últimos 30d
    - Uso do serviço (15 pts): qtd de projetos ativos
    - Satisfação com conteúdo (15 pts): media de scores de aprovação cliente
    """
    dados = buscar_dados_cliente(cliente_slug, qdrant_client)
    
    score_nps = min(dados.get("ultimo_nps", 7) * 3.33, 30)
    score_engajamento = calcular_score_engajamento(dados["historico_respostas"])
    score_entrega = calcular_score_entrega(dados["deliveries_30d"])
    score_uso = min(dados["projetos_ativos"] * 5, 15)
    score_conteudo = calcular_score_aprovacoes(dados["aprovacoes_cliente"])
    
    total = score_nps + score_engajamento + score_entrega + score_uso + score_conteudo
    
    status = "saudavel" if total >= 80 else "atencao" if total >= 50 else "risco"
    
    return {
        "cliente": cliente_slug,
        "score_total": round(total),
        "status": status,
        "componentes": {
            "nps": score_nps,
            "engajamento": score_engajamento,
            "entrega": score_entrega,
            "uso": score_uso,
            "conteudo": score_conteudo
        },
        "calculado_em": datetime.utcnow().isoformat()
    }
```

#### Coleções Qdrant Acessadas

- `clients` — dados e histórico de relacionamento
- `analytics` — métricas de performance
- `campaigns` — status de projetos
- `approvals_history` — histórico de aprovações

---

## 6. Schema Qdrant — Todas as Coleções

### 6.1 Visão Geral

```
Qdrant (768d vectors — nomic-embed-text via LiteLLM :4000)
│
├── clients                    ← master de clientes
├── campaigns                  ← campanhas e projetos
├── assets                     ← assets indexados semanticamente
├── brand_guides               ← brand guides vetorizados
├── analytics                  ← métricas e performance
├── templates                  ← templates reutilizáveis
├── video_metadata             ← metadados de vídeos
├── approvals_history          ← histórico de aprovações
└── ceo_context               ← contexto de conversas
```

### 6.2 Coleção: `clients`

```json
{
  "collection": "clients",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "slug": "keyword",
    "nome_empresa": "text",
    "setor": "keyword",
    "cnpj": "keyword",
    "responsavel_nome": "text",
    "responsavel_contato": "keyword",
    "canal_preferido": "keyword",
    "data_inicio": "datetime",
    "data_renovacao": "datetime",
    "plano": "keyword",
    "budget_mensal": "float",
    "status": "keyword",
    "health_score": "integer",
    "ultimo_nps": "float",
    "plataformas_ativas": "keyword[]",
    "qdrant_prefix": "keyword",
    "pasta_raiz": "keyword",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### 6.3 Coleção: `campaigns`

```json
{
  "collection": "campaigns",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "nome": "text",
    "objetivo": "text",
    "plataformas": "keyword[]",
    "data_inicio": "datetime",
    "data_fim": "datetime",
    "status": "keyword",
    "budget": "float",
    "budget_consumido": "float",
    "milestones": "json",
    "taskflow_id": "keyword",
    "agentes_envolvidos": "keyword[]",
    "kpis_meta": "json",
    "kpis_realizados": "json",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### 6.4 Coleção: `brand_guides`

```json
{
  "collection": "brand_guides",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "cliente_slug": "keyword",
    "versao": "keyword",
    "cores_primarias": "json",
    "cores_secundarias": "json",
    "cores_proibidas": "keyword[]",
    "fontes_titulos": "json",
    "fontes_corpo": "json",
    "tom_de_voz": "keyword",
    "nivel_formalidade": "integer",
    "palavras_aprovadas": "keyword[]",
    "palavras_proibidas": "keyword[]",
    "valores_marca": "keyword[]",
    "persona_primaria": "json",
    "concorrentes": "keyword[]",
    "elemento_logo_area_protecao": "float",
    "versao_documento": "keyword",
    "aprovado_em": "datetime",
    "aprovado_por": "keyword"
  }
}
```

### 6.5 Coleção: `assets`

```json
{
  "collection": "assets",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "nome_arquivo": "keyword",
    "caminho_absoluto": "keyword",
    "tipo": "keyword",
    "subtipo": "keyword",
    "plataforma": "keyword",
    "campanha_id": "keyword",
    "tags_semanticas": "keyword[]",
    "hash_sha256": "keyword",
    "tamanho_bytes": "integer",
    "dimensoes": "json",
    "aprovado_brand_guardian": "bool",
    "score_brand": "float",
    "criado_em": "datetime",
    "atualizado_em": "datetime",
    "criado_por_agente": "keyword"
  }
}
```

### 6.6 Coleção: `analytics`

```json
{
  "collection": "analytics",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "post_id": "keyword",
    "campanha_id": "keyword",
    "plataforma": "keyword",
    "tipo_conteudo": "keyword",
    "data_publicacao": "datetime",
    "alcance": "integer",
    "impressoes": "integer",
    "engajamentos": "integer",
    "taxa_engajamento": "float",
    "likes": "integer",
    "comments": "integer",
    "shares": "integer",
    "saves": "integer",
    "cliques": "integer",
    "conversoes": "integer",
    "cpm": "float",
    "cpc": "float",
    "cpa": "float",
    "roi": "float",
    "content_score": "float",
    "coletado_em": "datetime"
  }
}
```

### 6.7 Coleção: `video_metadata`

```json
{
  "collection": "video_metadata",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "nome_arquivo": "keyword",
    "caminho": "keyword",
    "tipo": "keyword",
    "duracao_segundos": "float",
    "resolucao": "keyword",
    "fps": "float",
    "bitrate": "integer",
    "versao": "keyword",
    "status": "keyword",
    "transcricao_disponivel": "bool",
    "legendas_geradas": "bool",
    "decupagem_gerada": "bool",
    "frames_extraidos": "integer",
    "score_brand_guardian": "float",
    "notas_editor": "text",
    "created_at": "datetime"
  }
}
```

### 6.8 Coleção: `approvals_history`

```json
{
  "collection": "approvals_history",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "asset_id": "keyword",
    "tipo_conteudo": "keyword",
    "agente_criador": "keyword",
    "score_brand": "float",
    "status_brand_guardian": "keyword",
    "problemas_detectados": "json",
    "status_cliente": "keyword",
    "feedback_cliente": "text",
    "iteracoes": "integer",
    "tempo_aprovacao_horas": "float",
    "aprovado_em": "datetime"
  }
}
```

### 6.9 Coleção: `templates`

```json
{
  "collection": "templates",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "nome": "text",
    "tipo": "keyword",
    "plataforma": "keyword",
    "setor": "keyword",
    "framework": "keyword",
    "conteudo": "text",
    "variaveis": "keyword[]",
    "uso_count": "integer",
    "taxa_aprovacao": "float",
    "criado_em": "datetime"
  }
}
```

### 6.10 Coleção: `ceo_context`

```json
{
  "collection": "ceo_context",
  "vector_size": 768,
  "distance": "Cosine",
  "payload_schema": {
    "id": "keyword",
    "cliente_slug": "keyword",
    "canal": "keyword",
    "mensagem_usuario": "text",
    "resposta_agente": "text",
    "agentes_consultados": "keyword[]",
    "intencao_detectada": "keyword",
    "session_id": "keyword",
    "timestamp": "datetime"
  }
}
```

---

## 7. Estrutura de Pastas Completa

```
~/.openclaw/
├── workspace/
│   ├── agents/
│   │   ├── ceo-mix/
│   │   │   └── SOUL.md
│   │   ├── video-editor/
│   │   │   └── SOUL.md
│   │   ├── organizador/
│   │   │   └── SOUL.md
│   │   ├── onboarding/
│   │   │   └── SOUL.md
│   │   ├── creative/
│   │   │   └── SOUL.md
│   │   ├── design/
│   │   │   └── SOUL.md
│   │   ├── social-media/
│   │   │   └── SOUL.md
│   │   ├── project-manager/
│   │   │   └── SOUL.md
│   │   ├── analytics/
│   │   │   └── SOUL.md
│   │   ├── brand-guardian/
│   │   │   └── SOUL.md
│   │   └── client-success/
│   │       └── SOUL.md
│   │
│   ├── skills/
│   │   ├── ceo-mix/
│   │   │   ├── SKILL.md
│   │   │   └── scripts/
│   │   │       └── intent_router.py
│   │   ├── video-editor/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── decupagem_gen.py
│   │   │   │   ├── srt_gen.py
│   │   │   │   ├── thumb_rank.py
│   │   │   │   ├── brand_frame_check.py
│   │   │   │   └── rename_batch.py
│   │   │   ├── references/
│   │   │   │   └── ffmpeg_presets.yaml
│   │   │   └── assets/
│   │   │       └── decupagem_template.md
│   │   ├── organizador/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── create_client_structure.py
│   │   │   │   ├── rename_enforce.py
│   │   │   │   ├── duplicate_detect.py
│   │   │   │   └── manifest_gen.py
│   │   │   └── references/
│   │   │       └── naming_convention.yaml
│   │   ├── onboarding/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── qdrant_client_setup.py
│   │   │   │   ├── color_extract.py
│   │   │   │   └── brand_guide_gen.py
│   │   │   ├── workflows/
│   │   │   │   └── onboarding_completo.yaml
│   │   │   └── assets/
│   │   │       └── welcome_package_template.md
│   │   ├── creative/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── copy_gen.py
│   │   │   │   └── hashtag_research.py
│   │   │   ├── references/
│   │   │   │   ├── platform_specs.yaml
│   │   │   │   └── frameworks_guide.md
│   │   │   └── assets/
│   │   │       └── ctas/
│   │   │           └── cta_library.json
│   │   ├── design/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── brand_check.py
│   │   │   │   ├── color_extract.py
│   │   │   │   └── brief_gen.py
│   │   │   └── references/
│   │   │       └── platform_dimensions.yaml
│   │   ├── social-media/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── calendar_gen.py
│   │   │   │   ├── best_time.py
│   │   │   │   └── trend_monitor.py
│   │   │   └── references/
│   │   │       └── hashtag_database.json
│   │   ├── project-manager/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── sla_monitor.py
│   │   │   │   ├── budget_tracker.py
│   │   │   │   └── workload_balance.py
│   │   │   ├── workflows/
│   │   │   │   └── campanha_completa.yaml
│   │   │   └── assets/
│   │   │       └── kanban.html
│   │   ├── analytics/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── roi_calc.py
│   │   │   │   ├── content_score.py
│   │   │   │   └── anomaly_detect.py
│   │   │   └── assets/
│   │   │       └── dashboard.html
│   │   ├── brand-guardian/
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/
│   │   │   │   ├── visual_check.py
│   │   │   │   └── text_tone_check.py
│   │   │   └── references/
│   │   │       └── approval_rubric.yaml
│   │   └── client-success/
│   │       ├── SKILL.md
│   │       ├── scripts/
│   │       │   ├── health_score.py
│   │       │   └── churn_detect.py
│   │       └── assets/
│   │           └── nps_survey_template.md
│   │
│   ├── clientes/
│   │   └── {slug}/
│   │       ├── brand-guide/
│   │       ├── campanhas/
│   │       ├── social/
│   │       ├── videos/
│   │       ├── docs/
│   │       ├── reports/
│   │       └── arquivo-morto/
│   │
│   └── extensions/
│       └── agency-suite/
│           ├── plugin.json
│           └── index.js
│
└── openclaw.json  ← configuração principal
```

---

## 8. Diagramas de Fluxo — Workflows Chave

### 8.1 Onboarding de Novo Cliente

```
Cliente → CEO MIX: "Quero contratar a agência"
         │
         ▼
CEO MIX classifica intenção: ONBOARDING
         │
         ▼
CEO MIX → sessions_send(onboarding-agent, {intent: "novo_cliente"})
         │
         ▼
ONBOARDING inicia TaskFlow: onboarding_completo
         │
    ┌────┴────────────────────────────────────────────────────┐
    │                                                         │
    ▼                                                         ▼
Coleta dados em             ONBOARDING processa
blocos (3 msgs max)         uploads (logo, refs)
    │                            │
    │                            ▼
    │                     color_extract.py
    │                     (extrai paleta)
    │                            │
    └────────────┬───────────────┘
                 │
                 ▼
         Gera brand_guide_draft.md
                 │
                 ▼
ONBOARDING → sessions_send(organizador-agent, {
  intent: "create_structure",
  slug: "novo-cliente"
})
                 │
                 ▼
ORGANIZADOR cria estrutura de pastas
+ indexa no Qdrant (clients collection)
                 │
                 ▼
ONBOARDING setup Qdrant collections para cliente
                 │
                 ▼
CEO MIX envia brand_guide_draft para aprovação do cliente
                 │
         ┌───────┴────────┐
         ▼                ▼
    APROVADO          REJEITADO
         │                │
         ▼                ▼
n8n: welcome_package  Revisão de dados
(PDF + links)              │
         │            goto: coleta
         ▼
CLIENT SUCCESS: registra cliente
PROJECT MANAGER: cria projeto inicial
CEO MIX: "Bem-vindo! Seu workspace está pronto 🎉"
```

### 8.2 Pipeline de Produção de Vídeo

```
Editor Humano (Telegram): "Novo footage para [cliente]"
         │
         ▼
CEO MIX detecta: intent = video_production
         │
         ▼
CEO MIX → sessions_send(video-editor-agent, {
  intent: "process_footage",
  client: slug,
  footage_path: caminho
})
         │
         ▼
VIDEO EDITOR inicia TaskFlow: video_production_pipeline
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 1: Organização                        ║
    ║  Renomear footage → convenção de nomenclatura ║
    ║  Mover para /brutos/                         ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 2: Transcrição (wav2vec2 :8201)       ║
    ║  POST /transcribe {audio: ...}               ║
    ║  → transcricao_json                          ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 3: Geração de Legendas                ║
    ║  srt_gen.py → .srt + .vtt                   ║
    ║  Salvar em /legendas/                        ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 4: Extração de Frames (ffmpeg)        ║
    ║  Frames a cada 30s + frames de mudança       ║
    ║  Salvar em /miniaturas/                      ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 5: Análise de Brand (qwen2.5-vl)           ║
    ║  Verificar: cores, logo, qualidade           ║
    ║  → frames_aprovados, frames_alerta           ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 6: Decupagem Automática               ║
    ║  decupagem_gen.py                            ║
    ║  → decupagem.md + decupagem.json            ║
    ╚════╤══════════════════════════════════════════╝
         │
    ╔════╧══════════════════════════════════════════╗
    ║  ETAPA 7: Indexação no Qdrant               ║
    ║  video_metadata collection                   ║
    ║  assets collection                           ║
    ╚════╤══════════════════════════════════════════╝
         │
         ▼
CEO MIX → Editor Humano:
"Footage processado! Decupagem em /decupagem/. 
 Legendas PT-BR geradas (92 segmentos, 98% confiança).
 3 frames marcados para verificação de cor na etapa 4.
 Quer ouvir o resumo?"
```

### 8.3 Pipeline de Criação de Campanha

```
Cliente / Owner → CEO MIX: "Quero uma campanha para X"
         │
         ▼
CEO MIX coleta: objetivo, prazo, budget, plataformas
         │
         ▼
CEO MIX → PROJECT MANAGER: "nova campanha" (via ACP)
         │
         ▼
PROJECT MANAGER cria TaskFlow: campanha_completa
         │
         ├──────────────────────────────────────┐
         ▼                                      ▼
CREATIVE (copy)                          DESIGN (brief visual)
  ├─ busca brand guide (Qdrant)           ├─ busca brand guide
  ├─ gera 3 variações (A/B/C)            ├─ extrai dimensões
  └─ sugere hashtags                      └─ gera brief.md
         │                                      │
         └──────────────┬───────────────────────┘
                        ▼
              BRAND GUARDIAN revisa
              (visual + textual)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
      APROVADO           REJEITADO
         │                   │
         ▼                   └──→ Agente origem (retrabalho)
CEO MIX envia para cliente (approval)
         │
         ├─── APROVADO ──→ SOCIAL MEDIA agenda posts
         │                   PROJECT MANAGER atualiza TaskFlow
         │
         └─── REJEITADO ─→ CREATIVE revisa briefing
```

### 8.4 Pipeline de Aprovação de Conteúdo

```
Conteúdo Gerado (copy + visual)
         │
         ▼
  ┌──────────────────────────────────────────────────┐
  │              BRAND GUARDIAN                     │
  │                                                  │
  │  Análise Visual (qwen2.5-vl):                        │
  │  ├─ Score de cor: X/10                          │
  │  ├─ Score tipografia: X/10                      │
  │  ├─ Score layout: X/10                          │
  │  └─ Score logo: X/10                            │
  │                                                  │
  │  Análise Textual (LLM):                         │
  │  ├─ Tom de voz: alinhado/desalinhado            │
  │  ├─ Palavras proibidas: detectadas/limpas       │
  │  └─ Mensagem: alinhada/desalinhada              │
  │                                                  │
  │  Score Composto:                                │
  │  (visual × 0.5) + (textual × 0.5) = TOTAL      │
  └──────────────┬──────────────────────────────────┘
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
   ≥8.0       6.0-7.9     <6.0
     │           │           │
  APROVADO   REVISÃO      REJEITADO
  (→ cliente) (→ ajustes   (→ agente
              menores)      criador)
                 │
    ┌────────────┴────────────────────┐
    │  Feedback estruturado:         │
    │  ✅ O QUE ESTÁ BOM             │
    │  ⚠️  O QUE PRECISA MUDAR      │
    │  🔧 COMO CORRIGIR              │
    └─────────────────────────────────┘
```

### 8.5 Pipeline de Relatório Mensal

```
Cron: dia 1 de cada mês, 08:00
         │
         ▼
ANALYTICS Agent inicia (por cliente ativo)
         │
    ┌────┴──────────────────────────────────────────┐
    │                                               │
    ▼                                               ▼
Coleta dados (Qdrant analytics)          Coleta NPS (CLIENT SUCCESS)
├─ posts do mês                          ├─ último score NPS
├─ engajamento médio                     ├─ health score
├─ crescimento de seguidores             └─ feedback do mês
├─ top 3 posts
└─ ROI (se dados disponíveis)
    │                                               │
    └──────────────────┬────────────────────────────┘
                       │
                       ▼
              Gera relatório em:
              ├─ Markdown (raw)
              ├─ PDF (n8n → PDF generator)
              └─ Canvas Dashboard (HTML atualizado)
                       │
                       ▼
              Gera resumo executivo (LLM)
                       │
                       ▼
              Gera áudio do resumo (TTS Bridge :8013)
              (voz pm_santa, 3-5 minutos)
                       │
                       ▼
CEO MIX envia para:
├─ Dono da agência: PDF + áudio
└─ Cliente (via Telegram): resumo texto + link dashboard
```

---

## 9. Exemplos TaskFlow

### 9.1 TaskFlow: Vídeo de Reel para Instagram

```json
{
  "taskflow_id": "tf_20260409_reel_marcax_001",
  "nome": "Reel Instagram — Lançamento Linha Premium",
  "cliente": "marca-x",
  "campanha": "lancamento-linha-premium-2026q2",
  "criado_em": "2026-04-09T12:00:00-03:00",
  "criado_por": "project-manager-agent",
  "status": "em_andamento",
  "revision": 3,
  "etapas": [
    {
      "id": 1,
      "nome": "Brief Criativo",
      "agente": "creative-agent",
      "status": "concluido",
      "iniciado_em": "2026-04-09T12:05:00-03:00",
      "concluido_em": "2026-04-09T12:23:00-03:00",
      "output": "brief_reel_marcax_001.md",
      "revisao_numero": 1
    },
    {
      "id": 2,
      "nome": "Script do Reel (30s)",
      "agente": "creative-agent",
      "status": "concluido",
      "output": "script_reel_v2.md",
      "revisao_numero": 2
    },
    {
      "id": 3,
      "nome": "Brief Visual (Design)",
      "agente": "design-agent",
      "status": "concluido",
      "output": "brief_visual_reel.md + specs.json",
      "revisao_numero": 1
    },
    {
      "id": 4,
      "nome": "Revisão Brand Guardian",
      "agente": "brand-guardian-agent",
      "status": "em_andamento",
      "sla": "4h",
      "dependencias": [2, 3],
      "score_parcial": 7.8,
      "notas": "Tipografia no frame 3 precisa correção (corpo em Inter ao invés de Montserrat)"
    },
    {
      "id": 5,
      "nome": "Aprovação do Cliente",
      "agente": "ceo-mix",
      "status": "pendente",
      "dependencias": [4],
      "timeout": "72h",
      "canal": "telegram-cliente"
    },
    {
      "id": 6,
      "nome": "Upload para Pasta Final",
      "agente": "organizador-agent",
      "status": "pendente",
      "dependencias": [5]
    },
    {
      "id": 7,
      "nome": "Agendamento Social",
      "agente": "social-media-agent",
      "status": "pendente",
      "dependencias": [6],
      "data_agendada": "2026-04-15T09:00:00-03:00"
    }
  ],
  "historico_mutacoes": [
    {
      "revisao": 1,
      "timestamp": "2026-04-09T12:05:00-03:00",
      "agente": "project-manager-agent",
      "acao": "taskflow_criado"
    },
    {
      "revisao": 2,
      "timestamp": "2026-04-09T12:23:00-03:00",
      "agente": "creative-agent",
      "acao": "brief_concluido",
      "etapa_id": 1
    },
    {
      "revisao": 3,
      "timestamp": "2026-04-09T14:10:00-03:00",
      "agente": "brand-guardian-agent",
      "acao": "revisao_iniciada",
      "etapa_id": 4
    }
  ]
}
```

### 9.2 TaskFlow: Onboarding de Cliente (Compacto)

```json
{
  "taskflow_id": "tf_20260409_onboarding_clienteabc",
  "nome": "Onboarding — Cliente ABC",
  "cliente": "cliente-abc",
  "status": "concluido",
  "etapas": [
    {"id": 1, "nome": "Coleta dados básicos", "status": "concluido", "duracao_min": 15},
    {"id": 2, "nome": "Coleta identidade visual", "status": "concluido", "duracao_min": 25},
    {"id": 3, "nome": "Coleta público e tom", "status": "concluido", "duracao_min": 12},
    {"id": 4, "nome": "Gerar brand guide draft", "status": "concluido", "duracao_min": 8},
    {"id": 5, "nome": "Criar estrutura de pastas", "status": "concluido", "duracao_min": 2},
    {"id": 6, "nome": "Setup Qdrant collections", "status": "concluido", "duracao_min": 1},
    {"id": 7, "nome": "Aprovação brand guide", "status": "concluido", "duracao_horas": 6},
    {"id": 8, "nome": "Envio welcome package", "status": "concluido", "duracao_min": 3},
    {"id": 9, "nome": "Notificação equipe interna", "status": "concluido", "duracao_min": 1}
  ],
  "duracao_total": "7h08min",
  "meta_sla": "48h",
  "resultado": "onboarding_concluido_dentro_do_sla"
}
```

---

## 10. Especificações de Cron Jobs

### 10.1 Tabela Completa de Cron Jobs

| Nome | Schedule (cron) | Agente | Ação | Notifica |
|------|----------------|--------|------|---------|
| `morning_briefing` | `0 7 * * 1-5` | analytics-agent | Resumo de status de todos os clientes | CEO MIX (dono agência) |
| `trend_monitoring` | `0 8 * * *` | social-media-agent | Research de tendências | CEO MIX |
| `sla_check` | `0 * * * *` | project-manager-agent | Verifica SLAs a vencer em 24h | CEO MIX + agente responsável |
| `post_performance` | `0 9 * * *` | social-media-agent | Performance de posts das últimas 48h | analytics-agent |
| `health_score_calc` | `0 10 * * *` | client-success-agent | Calcula health score de todos os clientes | CEO MIX |
| `anomaly_check` | `0 */6 * * *` | analytics-agent | Detecta anomalias nas métricas | CEO MIX |
| `weekly_calendar` | `0 7 * * 1` | social-media-agent | Gera calendário editorial da semana | project-manager-agent |
| `weekly_report` | `0 17 * * 5` | analytics-agent | Relatório semanal por cliente | CEO MIX + clientes |
| `monthly_report` | `0 8 1 * *` | analytics-agent | Relatório mensal completo | todos |
| `renewal_check_30d` | `0 9 1 * *` | client-success-agent | Contratos vencendo em 30 dias | CEO MIX |
| `renewal_check_7d` | `0 9 * * 1` | client-success-agent | Contratos vencendo em 7 dias | CEO MIX (urgente) |
| `asset_audit` | `0 3 * * 0` | organizador-agent | Verifica duplicatas e órfãos | CEO MIX |
| `brand_guide_sync` | `0 4 * * *` | brand-guardian-agent | Sincroniza brand guides no Qdrant | — |
| `nps_survey` | `0 10 * * 5` | client-success-agent | Envia NPS para clientes com entrega na semana | — |

### 10.2 Configuração de Cron no openclaw.json

```json
{
  "cron": {
    "jobs": [
      {
        "name": "morning_briefing",
        "schedule": "0 7 * * 1-5",
        "agent": "analytics-agent",
        "action": "generate_morning_briefing",
        "params": {"format": ["voice", "text"], "recipients": ["owner"]},
        "timezone": "America/Bahia",
        "enabled": true
      },
      {
        "name": "sla_check",
        "schedule": "0 * * * *",
        "agent": "project-manager-agent",
        "action": "check_sla_alerts",
        "params": {"alert_threshold_hours": 24},
        "timezone": "America/Bahia",
        "enabled": true
      },
      {
        "name": "monthly_report",
        "schedule": "0 8 1 * *",
        "agent": "analytics-agent",
        "action": "generate_monthly_report_all_clients",
        "params": {"format": ["pdf", "voice", "canvas"]},
        "timezone": "America/Bahia",
        "enabled": true
      }
    ]
  }
}
```

---

## 11. Especificações dos Canvas Dashboards

### 11.1 Dashboard 1: Kanban Board (Project Manager)

**Trigger:** Qualquer membro da equipe com acesso ao canal interno  
**URL Canvas:** `canvas://agency/kanban`  
**Atualização:** Em tempo real via eventos TaskFlow

**Componentes:**
- 4 colunas: Backlog | Em Andamento | Em Revisão | Concluído
- Cards com: título da tarefa, cliente, agente responsável, prazo, prioridade
- Filtros: por cliente, por agente, por data
- Contador de itens por coluna
- Indicador de SLA: 🟢 no prazo | 🟡 atenção (24h) | 🔴 atrasado

### 11.2 Dashboard 2: Analytics (Analytics Agent)

**Trigger:** Cron mensal/semanal ou `/dashboard [cliente]`  
**URL Canvas:** `canvas://agency/analytics/{slug}`  
**Atualização:** Semanal automático + sob demanda

**Componentes:**
- KPI Cards topo: Alcance Total | Engajamento Médio | Crescimento Seguidores | ROI
- Gráfico de linha: evolução dos KPIs últimos 90 dias
- Grid "Top Posts": 6 melhores posts do período com métricas
- Tabela Competitor: comparativo com 3 concorrentes principais
- Seção "Recomendações": 3 ações priorizadas geradas por LLM
- NPS trend: histórico de NPS do cliente

### 11.3 Dashboard 3: Client Health (Client Success)

**Trigger:** Cron diário ou `/health [cliente]`  
**URL Canvas:** `canvas://agency/health`  
**Atualização:** Diário às 10:00

**Componentes:**
- Mapa de calor de clientes: verde/amarelo/vermelho
- Health Score detalhe por cliente
- Alertas ativos: renovações, NPS baixo, churn risk
- Timeline de próximas ações recomendadas

### 11.4 Dashboard 4: Brand Compliance (Brand Guardian)

**Trigger:** Pós-revisão de lote ou `/brand-audit [cliente]`  
**URL Canvas:** `canvas://agency/brand/{slug}`

**Componentes:**
- Score de conformidade de marca: histórico 30 dias
- Últimas 10 revisões: aprovado/rejeitado com score
- Problemas mais frequentes (top 5)
- Brand Guide viewer: cores, fontes, exemplos

---

## 12. Especificações de Workflows n8n

### 12.1 Workflow: Welcome Package

```
Trigger: webhook POST /webhook/welcome-package
  payload: {cliente_slug, nome, email, telegram_id}
  │
  ├─ Node: Busca brand guide no Qdrant
  │
  ├─ Node: Gera PDF do brand guide (PDF Generator)
  │
  ├─ Node: Envia PDF via Telegram Bot
  │    telegram_id + mensagem de boas-vindas
  │
  ├─ Node: Envia e-mail de boas-vindas (SendGrid/SMTP)
  │    template: welcome_email.html
  │
  └─ Node: Registra no Qdrant (clients collection)
       status: onboardado
       onboarding_completo_em: now()
```

### 12.2 Workflow: Agendamento de Post Social

```
Trigger: webhook POST /webhook/schedule-post
  payload: {cliente_slug, plataforma, data_hora, asset_path, copy, hashtags}
  │
  ├─ Node: Valida dados (Schema validation)
  │
  ├─ Node: Verificação BRAND GUARDIAN (OpenClaw API)
  │    Se não aprovado: → notifica social-media-agent
  │
  ├─ Node: Switch por plataforma
  │    ├─ Instagram → Meta Business API
  │    ├─ LinkedIn → LinkedIn API  
  │    ├─ TikTok → TikTok API
  │    └─ YouTube → YouTube Data API
  │
  ├─ Node: Registra no Qdrant (campaigns collection)
  │    status: agendado, data_agendada: ...
  │
  └─ Node: Notifica social-media-agent + CEO MIX
       "Post agendado: [descrição] para [data_hora]"
```

### 12.3 Workflow: Coleta de Analytics de Posts

```
Trigger: Cron 0 9 * * * (diário às 9h)
  │
  ├─ Node: Busca posts publicados nas últimas 48h (Qdrant)
  │
  ├─ Node: Para cada post, busca métricas na API correspondente
  │    ├─ Instagram: Insights API
  │    ├─ LinkedIn: Analytics API
  │    └─ etc.
  │
  ├─ Node: Normaliza dados (todas as plataformas → schema padrão)
  │
  ├─ Node: Salva no Qdrant (analytics collection)
  │
  ├─ Node: Detecta anomalias (scripts/anomaly_detect.py)
  │    Se anomalia: → notifica analytics-agent
  │
  └─ Node: Atualiza dashboard Canvas
```

### 12.4 Workflow: NPS Survey Automático

```
Trigger: Cron 0 10 * * 5 (toda sexta às 10h) + evento pós-entrega
  │
  ├─ Node: Busca clientes elegíveis para NPS
  │    (critério: entrega na última semana OU 30d sem NPS)
  │
  ├─ Node: Para cada cliente elegível:
  │    Envia via Telegram:
  │    "Em uma escala de 0-10, o quanto você recomendaria 
  │     nossa agência? Responda com um número."
  │
  ├─ Node: Aguarda resposta (timeout: 48h)
  │
  ├─ Node: Registra NPS no Qdrant (clients collection)
  │
  ├─ Node: Se NPS < 7:
  │    → Notifica client-success-agent urgente
  │    → Agenda check-in proativo em 24h
  │
  └─ Node: Atualiza health_score do cliente
```

### 12.5 Workflow: Monitoramento de Arquivo (Watchdog)

```
Trigger: inotifywait evento em ~/.openclaw/workspace/clientes/
  payload: {event_type, file_path, client_slug}
  │
  ├─ Node: Classifica evento (novo arquivo, modificação, deleção)
  │
  ├─ Node: Se novo arquivo:
  │    ├─ Verifica naming convention
  │    ├─ Extrai embedding (nomic-embed via LiteLLM)
  │    ├─ Verifica duplicata (Qdrant similarity search)
  │    └─ Indexa no Qdrant (assets collection)
  │
  ├─ Node: Se duplicata detectada:
  │    → Notifica organizador-agent
  │    → Aguarda decisão humana
  │
  └─ Node: Gera/atualiza manifesto de assets do cliente
```

---

## 13. Tabela de Decisão de Roteamento

### 13.1 Matrix: Qual Agente para Qual Situação?

| Situação / Trigger | Agente Principal | Agentes de Suporte | Canal |
|-------------------|-----------------|-------------------|-------|
| "Quero contratar a agência" | ONBOARDING | ORGANIZADOR, CEO MIX | Telegram/WhatsApp |
| Upload de footage | VIDEO EDITOR | ORGANIZADOR, BRAND GUARDIAN | Telegram |
| "Preciso de um post para X" | CREATIVE | DESIGN, BRAND GUARDIAN, SOCIAL MEDIA | Telegram/WhatsApp |
| "Como está o projeto Y?" | PROJECT MANAGER | CEO MIX | Telegram |
| "Quero ver os números do mês" | ANALYTICS | CEO MIX | Telegram/Canvas |
| Novo arquivo detectado na pasta | ORGANIZADOR | BRAND GUARDIAN | Automático |
| Cron: monday 7am | SOCIAL MEDIA | PROJECT MANAGER, CEO MIX | Interno |
| Cron: 1st of month | ANALYTICS | CLIENT SUCCESS, CEO MIX | Interno |
| NPS response < 7 | CLIENT SUCCESS | CEO MIX | Telegram |
| Conteúdo para aprovação | BRAND GUARDIAN | Agente criador, CEO MIX | Interno |
| Deadline em 24h | PROJECT MANAGER | CEO MIX, agente responsável | Telegram |
| Renovação em 30d | CLIENT SUCCESS | CEO MIX | Telegram |
| "Precisa de um brief de design" | DESIGN | CREATIVE, BRAND GUARDIAN | Telegram |

### 13.2 Escalada para Humano

| Situação | Prazo de Escalada | Receptor |
|----------|------------------|---------|
| NPS < 7 | Imediato | Dono da agência |
| SLA breach | 1h antes | Dono da agência + gerente |
| Budget > 90% consumido | Imediato | Dono da agência |
| Brand Guardian rejeita 2x | Após 2ª rejeição | Diretor de criação |
| Cliente sem resposta 48h | Após 48h | Gerente de conta |
| Anomalia de métrica > 2 sigma | Imediato | Analista + CEO MIX |
| Erro de processamento de vídeo | Imediato | Editor de vídeo |

---

## 14. Matriz de Riscos

### 14.1 Riscos Técnicos

| # | Risco | Probabilidade | Impacto | Score | Mitigação |
|---|-------|--------------|---------|-------|----------|
| R01 | Falha do LiteLLM (modelo indisponível) | Médio | Alto | 🔴 Alto | Fallback chain: MiniMax M2.7 → GPT-4o-mini; retry 3x |
| R02 | Qdrant OOM com muitos clientes | Baixo | Alto | 🟡 Médio | Sharding por cliente; monitoramento de memória |
| R03 | wav2vec2 timeout em vídeos longos | Alto | Médio | 🟡 Médio | Chunking de 10min; processamento assíncrono |
| R04 | qwen2.5-vl falsa negativa em brand check [DEPRECATED - era llava] | Médio | Médio | 🟡 Médio | Revisão humana obrigatória para score 7-8 |
| R05 | n8n fila saturada (muitos posts) | Baixo | Médio | 🟢 Baixo | Rate limiting por cliente; queue prioritária |
| R06 | ACP deadlock entre agentes | Baixo | Alto | 🟡 Médio | Timeout de 30min em sessions_send; circuit breaker |
| R07 | Infisical vault indisponível | Muito Baixo | Crítico | 🟡 Médio | Cache local de secrets (TTL 1h); failover manual |
| R08 | Perda de TaskFlow state | Muito Baixo | Alto | 🟢 Baixo | Persistência em disco + backup Qdrant |
| R09 | Kokoro TTS lentidão em pico | Médio | Baixo | 🟢 Baixo | TTS assíncrono; queue; modo texto como fallback |
| R10 | Exaustão de storage em /brutos/ | Médio | Médio | 🟡 Médio | Monitoramento de disco; alerta a 80% |

### 14.2 Riscos de Negócio

| # | Risco | Probabilidade | Impacto | Score | Mitigação |
|---|-------|--------------|---------|-------|----------|
| R11 | Agente gera copy off-brand e vai ao cliente | Baixo | Alto | 🟡 Médio | BRAND GUARDIAN obrigatório antes de todo envio |
| R12 | Cliente insatisfeito com IA sem saber | Médio | Alto | 🟡 Médio | Transparência sobre uso de IA; human review para contas VIP |
| R13 | Versionamento de brand guide inconsistente | Médio | Médio | 🟡 Médio | BRAND GUARDIAN controla versão; changelog automático |
| R14 | Deadlines perdidos por erro de cron | Baixo | Alto | 🟡 Médio | Monitoramento de heartbeat; alerta se cron falha 2x |
| R15 | Churn por excesso de automação percebida | Médio | Alto | 🟡 Médio | Interações de voz humanizadas; escalada rápida para humano |

### 14.3 Tabela de Resposta a Incidentes

| Incidente | Detecção | Resposta Automática | Escala Humana |
|-----------|---------|---------------------|--------------|
| LiteLLM down | Health check 30s | Fallback automático | Após 3 falhas |
| Qdrant down | Ping 60s | Fila de operações | Após 5min |
| n8n workflow falha | Webhook de status | Retry 3x | Após 3 retries |
| NPS crítico | Resposta do cliente | Client Success ativado | Imediato |
| SLA breach | Cron horário | Alerta duplo | 1h antes do vencimento |

---

## 15. Roadmap por Fases

### Fase 1 — Fundação (Semanas 1-4)

**Objetivo:** Infraestrutura base e primeiros 2 agentes operacionais.

```
Semana 1-2: Setup de Infraestrutura
├─ Configurar openclaw.json com todos os agentes (stubs)
├─ Criar estrutura de pastas skills/ e agents/
├─ Criar SOUL.md para todos os agentes
├─ Setup das coleções Qdrant (schema completo)
└─ Configurar secrets no Infisical

Semana 3-4: CEO MIX + ONBOARDING
├─ CEO MIX: roteamento de intenções
├─ ONBOARDING: fluxo de intake completo
├─ ORGANIZADOR: criação de estrutura de pastas
└─ Teste com 1 cliente piloto (onboarding completo)
```

**Entregáveis Fase 1:**
- CEO MIX respondendo corretamente em Telegram/WhatsApp
- Onboarding de cliente em < 2h (manual < 3 dias)
- Estrutura de pastas criada automaticamente
- Qdrant populado com dados do cliente piloto

### Fase 2 — Core Criativo (Semanas 5-10)

**Objetivo:** Pipeline criativo completo operacional.

```
Semana 5-6: CREATIVE + DESIGN
├─ CREATIVE: copy com frameworks A/B/C
├─ DESIGN: brand check com qwen2.5-vl
└─ Integração: copy + design → mesmo contexto

Semana 7-8: BRAND GUARDIAN
├─ Pipeline de aprovação automática
├─ Feedback estruturado ao agente criador
└─ Histórico de aprovações no Qdrant

Semana 9-10: SOCIAL MEDIA + n8n
├─ Calendário editorial gerado automaticamente
├─ Integração APIs sociais via n8n
└─ Agendamento de posts automatizado
```

**Entregáveis Fase 2:**
- Copy gerado em < 5 minutos com 3 variações
- Brand check automático antes de todo envio ao cliente
- Posts agendados via n8n sem intervenção humana
- 2 clientes piloto usando o sistema

### Fase 3 — Vídeo + Gestão (Semanas 11-16)

**Objetivo:** Pipeline de vídeo e gestão de projetos completos.

```
Semana 11-12: VIDEO EDITOR
├─ Pipeline wav2vec2 → SRT/VTT
├─ Extração de frames com ffmpeg
├─ Decupagem automática
└─ Brand check de frames com qwen2.5-vl

Semana 13-14: PROJECT MANAGER
├─ TaskFlow para todos os tipos de projeto
├─ Kanban Canvas (dashboard)
├─ SLA monitoring com alertas
└─ Reports de status por voz

Semana 15-16: ANALYTICS
├─ Coleta automática de métricas via n8n
├─ Dashboard Canvas atualizado automaticamente
└─ Relatório mensal em voz (TTS)
```

**Entregáveis Fase 3:**
- Footage processado automaticamente em < 30min/hora de vídeo
- Kanban board em tempo real via Canvas
- Relatório mensal automático para todos os clientes

### Fase 4 — Inteligência e Escala (Semanas 17-24)

**Objetivo:** Inteligência avançada e escalabilidade.

```
Semana 17-18: CLIENT SUCCESS
├─ Health score diário para todos os clientes
├─ NPS automático via n8n
└─ Detecção de churn proativa

Semana 19-20: Otimizações de Performance
├─ Chunking de vídeos longos (wav2vec2)
├─ Caching de brand guides (TTL)
└─ Balanceamento de carga entre agentes

Semana 21-22: Integrações Avançadas
├─ Google Ads / Meta Ads (ROI real)
├─ CRM integration (dados de conversão)
└─ Relatórios avançados com dados paid media

Semana 23-24: Multi-cliente Escala
├─ Testes de carga com 10+ clientes simultâneos
├─ Documentação operacional completa
└─ Treinamento da equipe humana
```

**Entregáveis Fase 4:**
- Sistema estável com 10+ clientes ativos
- 0 relatórios manuais necessários
- Tempo médio de onboarding: < 2 horas
- NPS médio da agência: > 8.0

---

## 16. Métricas de Sucesso

### 16.1 Métricas Operacionais (Agência)

| Métrica | Baseline (hoje) | Meta Fase 1 | Meta Fase 4 |
|---------|----------------|-------------|-------------|
| Tempo de onboarding | 3-5 dias úteis | < 4 horas | < 1 hora |
| Tempo de geração de copy | 2-4 horas | 15 min | < 5 min |
| Tempo de decupagem de vídeo | 2-3h/hora de footage | 30min/hora | 15min/hora |
| Tempo para relatório mensal | 8-12h/cliente | 1h/cliente | < 15min |
| Taxa de aprovação de conteúdo na 1ª tentativa | 60% | 70% | > 85% |
| SLA breach rate | Desconhecido | < 10% | < 3% |
| Arquivos sem nomenclatura padrão | ~70% | < 30% | < 5% |

### 16.2 Métricas de Relacionamento (Clientes)

| Métrica | Baseline | Meta Fase 2 | Meta Fase 4 |
|---------|----------|-------------|-------------|
| NPS médio da agência | Desconhecido | > 7.0 | > 8.5 |
| Health score médio dos clientes | N/A | > 70 | > 80 |
| Churn rate mensal | ~5% | < 4% | < 2% |
| Tempo de resposta ao cliente | 2-4 horas | < 30 min | < 10 min |
| Taxa de renovação de contratos | ~60% | > 70% | > 85% |

### 16.3 Métricas Técnicas do Sistema

| Métrica | Meta |
|---------|------|
| Uptime do Gateway | > 99.5% |
| Latência de resposta CEO MIX (p95) | < 3 segundos |
| Sucesso de aprovação Brand Guardian | > 95% sem erro de sistema |
| Precisão de transcrição wav2vec2 (PT-BR) | > 90% WER |
| Tempo de processamento de footage (por hora de vídeo) | < 15 minutos |
| Taxa de sucesso de agendamento n8n | > 99% |

---

## 17. Apêndices

### Apêndice A: openclaw.json — Configuração Completa de Agentes

```json
{
  "agents": {
    "ceo-mix": {
      "enabled": true,
      "soul": "agents/ceo-mix/SOUL.md",
      "skills": ["skills/ceo-mix/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": ["telegram-main", "whatsapp-agency"],
      "memory": {
        "plugin": "qdrant",
        "collection": "ceo_context",
        "top_k": 10
      }
    },
    "video-editor": {
      "enabled": true,
      "soul": "agents/video-editor/SOUL.md",
      "skills": ["skills/video-editor/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": [],
      "sandbox": {"mode": "docker", "mounts": ["workspace/clientes:/workspace/clientes:rw"]},
      "memory": {
        "plugin": "qdrant",
        "collection": "video_metadata",
        "top_k": 5
      }
    },
    "organizador": {
      "enabled": true,
      "soul": "agents/organizador/SOUL.md",
      "skills": ["skills/organizador/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "assets",
        "top_k": 10
      }
    },
    "onboarding": {
      "enabled": true,
      "soul": "agents/onboarding/SOUL.md",
      "skills": ["skills/onboarding/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pf_dora",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "clients",
        "top_k": 5
      }
    },
    "creative": {
      "enabled": true,
      "soul": "agents/creative/SOUL.md",
      "skills": ["skills/creative/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pf_dora",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "templates",
        "top_k": 5
      }
    },
    "design": {
      "enabled": true,
      "soul": "agents/design/SOUL.md",
      "skills": ["skills/design/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pf_dora",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "brand_guides",
        "top_k": 5
      }
    },
    "social-media": {
      "enabled": true,
      "soul": "agents/social-media/SOUL.md",
      "skills": ["skills/social-media/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pf_dora",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "campaigns",
        "top_k": 10
      }
    },
    "project-manager": {
      "enabled": true,
      "soul": "agents/project-manager/SOUL.md",
      "skills": ["skills/project-manager/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "campaigns",
        "top_k": 15
      }
    },
    "analytics": {
      "enabled": true,
      "soul": "agents/analytics/SOUL.md",
      "skills": ["skills/analytics/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "analytics",
        "top_k": 20
      }
    },
    "brand-guardian": {
      "enabled": true,
      "soul": "agents/brand-guardian/SOUL.md",
      "skills": ["skills/brand-guardian/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pm_santa",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "brand_guides",
        "top_k": 5
      }
    },
    "client-success": {
      "enabled": true,
      "soul": "agents/client-success/SOUL.md",
      "skills": ["skills/client-success/SKILL.md"],
      "model": "minimax-m2.7",
      "voice": "pf_dora",
      "channels": [],
      "memory": {
        "plugin": "qdrant",
        "collection": "clients",
        "top_k": 10
      }
    }
  }
}
```

### Apêndice B: Convenção de Nomenclatura de Arquivos

```yaml
# ~/.openclaw/workspace/skills/organizador/references/naming_convention.yaml

padrao_geral: "AAAA-MM-DD_{slug-cliente}_{tipo}_{subtipo}_{versao}.{ext}"

tipos:
  brand:      "bg"    # brand guide
  campanha:   "camp"  # campanha
  social:     "soc"   # post social
  video:      "vid"   # vídeo
  decupagem:  "dec"   # sheet de decupagem
  legenda:    "leg"   # SRT/VTT
  miniatura:  "thumb" # thumbnail
  relatorio:  "rep"   # relatório
  briefing:   "brf"   # briefing
  export:     "exp"   # export final
  ref:        "ref"   # referência

plataformas:
  instagram:  "ig"
  linkedin:   "li"
  tiktok:     "tt"
  youtube:    "yt"
  facebook:   "fb"
  whatsapp:   "wa"
  email:      "em"

versoes: "v01, v02, v03, ..."

exemplos:
  - "2026-04-09_marca-x_bg_paleta_v01.json"
  - "2026-04-09_marca-x_soc_ig-feed_v03.jpg"
  - "2026-04-09_marca-x_vid_bruto_001.mp4"
  - "2026-04-09_marca-x_dec_entrevista_v01.md"
  - "2026-04-09_marca-x_leg_reel-lancamento_pt-BR.srt"
  - "2026-04-09_marca-x_rep_mensal-marco2026_v01.pdf"
```

### Apêndice C: Guia de Integração de Novo Agente

Para adicionar um novo agente especializado ao Agency Suite:

1. **Criar SOUL.md** em `agents/{nome}/SOUL.md` com personalidade, tom, regras
2. **Criar SKILL.md** em `skills/{nome}/SKILL.md` com capabilities, tools, examples
3. **Criar scripts/** em `skills/{nome}/scripts/` com implementações Python
4. **Registrar no openclaw.json** com model, voice, memory, sandbox config
5. **Criar coleção Qdrant** se necessário (via `scripts/qdrant_client_setup.py`)
6. **Registrar intents** no roteador do CEO MIX (`skills/ceo-mix/scripts/intent_router.py`)
7. **Definir cron jobs** se o agente tem tarefas periódicas (openclaw.json cron section)
8. **Criar canvas** se o agente tem dashboard (assets/{nome_dashboard}.html)
9. **Criar workflows n8n** se o agente precisa de integrações externas
10. **Escrever testes** em `skills/{nome}/tests/` com casos de uso cobertos

### Apêndice D: Glossário

| Termo | Definição |
|-------|-----------|
| ACP | Agent Communication Protocol — protocolo de comunicação entre agentes via sessions_send |
| Brand Guide | Documento que define identidade visual e verbal de um cliente |
| Canvas | Sistema de renderização HTML do OpenClaw para dashboards visuais |
| CEO MIX | Agente orquestrador central; único ponto de contato com o cliente |
| Decupagem | Sheet de logging de footage de vídeo com timecodes e transcrição |
| Health Score | Score 0-100 de saúde do relacionamento com o cliente |
| NPS | Net Promoter Score — métrica de satisfação e lealdade (0-10) |
| SOUL.md | Arquivo de personalidade e instruções de um agente OpenClaw |
| SKILL.md | Arquivo de capacidades, ferramentas e exemplos de um agente |
| SLA | Service Level Agreement — prazo contratual de entrega |
| TaskFlow | Sistema de workflows duráveis multi-etapa do OpenClaw |
| slug | Identificador único de um cliente em formato kebab-case (ex: marca-x) |
| STT | Speech-to-Text — transcrição de fala para texto (wav2vec2) |
| TTS | Text-to-Speech — síntese de voz (Kokoro via TTS Bridge) |
| WER | Word Error Rate — taxa de erro de transcrição (menor = melhor) |

### Apêndice E: Exemplo Completo de SKILL.md

```markdown
# SKILL: Video Editor

## Descrição
Agente especializado em produção de vídeo para agências de marketing. 
Organiza footage, transcreve áudio, gera legendas, extrai frames e 
cria sheets de decupagem automaticamente.

## Gatilhos
- Upload de arquivo de vídeo no canal Telegram
- Mensagem com "vídeo", "footage", "decupagem", "legenda"
- Task delegada pelo CEO MIX via ACP

## Ferramentas Disponíveis
- `bash` — executar ffmpeg e scripts Python
- `read/write` — ler/escrever arquivos no workspace
- `sessions_send` — comunicar com outros agentes (ORGANIZADOR, BRAND GUARDIAN)

## Serviços Externos
- wav2vec2 (10.0.19.6:8201) — transcrição de áudio
- LiteLLM (10.0.1.1:4000) — qwen2.5-vl para análise de frames
- Qdrant — indexação de metadados

## Exemplos de Uso

### Processamento de footage novo
User: [envia vídeo.mp4 de 8 minutos]
Agent: "Processando footage de 8min para [Cliente X]...
        ✅ Transcrição concluída (147 segmentos, 94% confiança)
        ✅ 96 legendas SRT geradas (PT-BR)
        ✅ 16 frames-chave extraídos
        ⚠️ 2 frames com possível incompatibilidade de cor (frames 3:24 e 6:11)
        ✅ Sheet de decupagem em /decupagem/2026-04-09_cliente-x_dec_entrevista_v01.md
        Deseja que eu analise os frames marcados com o brand guide?"

### Geração de SRT sob demanda
User: "Gera legenda em inglês também para o reel do dia 5"
Agent: "Gerarei a versão EN do SRT. Preciso de confirmação: devo usar 
        tradução automática ou você vai fornecer a tradução?"
```

### Apêndice F: Presets de ffmpeg por Plataforma

```yaml
# skills/video-editor/references/ffmpeg_presets.yaml

presets:
  instagram_reels:
    resolucao: "1080x1920"
    fps: 30
    codec_video: "libx264"
    codec_audio: "aac"
    bitrate_video: "4000k"
    bitrate_audio: "128k"
    formato: "mp4"
    comando: >
      ffmpeg -i {input} -vf scale=1080:1920:force_original_aspect_ratio=decrease,
      pad=1080:1920:(ow-iw)/2:(oh-ih)/2 -c:v libx264 -b:v 4000k 
      -c:a aac -b:a 128k -r 30 {output}
      
  youtube_hd:
    resolucao: "1920x1080"
    fps: 30
    codec_video: "libx264"
    codec_audio: "aac"
    bitrate_video: "8000k"
    bitrate_audio: "192k"
    
  thumbnail_extraction:
    intervalo_segundos: 30
    formato: "jpg"
    qualidade: 2
    comando: >
      ffmpeg -i {input} -vf fps=1/{intervalo} -q:v {qualidade} 
      {output_dir}/{slug}_%04d.jpg
      
  corte_clip:
    comando: >
      ffmpeg -i {input} -ss {inicio} -to {fim} -c:v copy -c:a copy {output}
```

---

## Notas Finais de Arquitetura

### Princípio de Responsabilidade Única

Cada agente neste sistema respeita o **Princípio da Responsabilidade Única** adaptado para IA:

- Um agente, um domínio de especialidade
- Delegação via ACP quando a tarefa cruza domínio
- CEO MIX como único árbitro de prioridade

### Estratégia de Rollout

O rollout deve seguir a ordem:

1. CEO MIX + ONBOARDING + ORGANIZADOR (sem criação de conteúdo ainda)
2. CREATIVE + DESIGN + BRAND GUARDIAN (criação controlada)
3. SOCIAL MEDIA + PROJECT MANAGER (operação autônoma supervisionada)
4. VIDEO EDITOR + ANALYTICS (pipelines pesados)
5. CLIENT SUCCESS (inteligência de relacionamento)

### Considerações de Segurança

- Todos os agentes não-main rodam em sandbox Docker (`agents.defaults.sandbox.mode: "non-main"`)
- Secrets exclusivamente via Infisical (nunca em SKILL.md ou SOUL.md)
- Logs de todas as mutações de TaskFlow com timestamp e agente responsável
- BRAND GUARDIAN funciona como camada de segurança de conteúdo (não contorna)
- Clientes recebem apenas respostas via CEO MIX (agentes internos invisíveis ao cliente)

---

*Documento gerado em 09 de abril de 2026. Versão 2.0 — DRAFT. Próxima revisão prevista após Fase 1 (4 semanas).*

*Para feedback ou revisões, acionar CEO MIX com: "Revisão SPEC-011"*