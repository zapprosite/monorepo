# Tasks: OpenClaw Agency — Voice-First Marketing

**Spec:** SPEC-011
**Status:** PENDING
**Created:** 2026-04-08

---

## Fase 1: Voice Briefing

| # | Task | Criteria | Verification |
|---|------|----------|--------------|
| 1.1 | Testar wav2vec2 STT com audio real | Audio PT-BR transcrito com <5% erro | `curl -X POST http://10.0.19.6:8201/transcribe -d @test.mp3` retorna texto |
| 1.2 | Criar skill `voice-briefing` no workspace | Skill aceite audio → texto → Qdrant | Enviar audio no Telegram → CEO MIX responde com transcricao |
| 1.3 | Popular Qdrant collection `clients` | 1 cliente de teste com brand_guide | Query retorna brand_guide correto |
| 1.4 | Criar template de briefing em Qdrant | Template com campos: objetivo, publico, orcamento | Search retorna template |
| 1.5 | Teste end-to-end | Audio → transcribe → copy → TTS preview | Cliente recebe audio com copy gerada |

---

## Fase 2: Sub-Agents Operacionais

| # | Task | Criteria | Verification |
|---|------|----------|--------------|
| 2.1 | Criar sub-agent CREATIVE | SOUL.md com expertise copy, AIDA/PAS | Responde com copy quando delegated |
| 2.2 | Criar sub-agent DESIGN | SOUL.md com expertise briefs visuais | Responde com brief quando delegated |
| 2.3 | Criar sub-agent SOCIAL | SOUL.md com expertise calendario | Responde com calendario quando delegated |
| 2.4 | Configurar agentToAgent | CEO MIX → sub-agents comunicam | Delegacao funciona via Telegram |
| 2.5 | Testar delegacao em paralelo | 3 sub-agents geram simultaneo | Tempo <15s total |

---

## Fase 3: Voice Reports

| # | Task | Criteria | Verification |
|---|------|----------|--------------|
| 3.1 | Criar template de relatorio | Estrutura: campanhas, metricas, proximos passos | Template existe em Qdrant |
| 3.2 | Gerar relatorio via TTS | CEO MIX → relatorio → TTS Bridge → Kokoro | Audio recebido no Telegram |
| 3.3 | Agendar relatorios automaticos | Cron ou n8n envia mensal | Cliente recebe sem pedir |

---

## Fase 4: Social Automation

| # | Task | Criteria | Verification |
|---|------|----------|--------------|
| 4.1 | Configurar n8n workflow | Trigger: approved campaign → publica | Post aparece na rede social |
| 4.2 | Criar sub-agent PROJECT | Gestao de timeline, status reports | Responde com timeline |
| 4.3 | Dashboard de campanhas | Status visual no Telegram | Lista campanhas + status |

---

## Fase 5: Brand Guide Engine

| # | Task | Criteria | Verification |
|---|------|----------|--------------|
| 5.1 | Integrar llava para analise | Image → descricao + validacao marca | llava retorna analise de marca |
| 5.2 | Gerar brand guide automaticamente | Cliente envia imagens → CEO MIX extrai cores, fontes, tom | Brand guide criado em Qdrant |
| 5.3 | Validacao de consistencia | Upload imagem → llava valida vs brand guide | Score de consistencia retornado |

---

## Checkpoints

| Fase | Antes de continuar | Responsavel |
|------|-------------------|-------------|
| 1 | ZFS snapshot + smoke test | will |
| 2 | CEO MIX delega corretamente | will |
| 3 | Cliente recebe voice report | will |
| 4 | Post publicado automaticamente | will |
| 5 | Brand guide validado por llava | will |
