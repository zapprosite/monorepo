# Phase 4: Reconhecimento de Placas e Componentes via Foto - Context

**Gathered:** 2026-05-05
**Status:** In Progress

## Boundary

Transformar a visão HVAC existente em um bloco confiável para análise de PCB/componentes a partir de fotos de campo. Esta fase não altera OpenWebUI público nem cria modelo novo; trabalha no tooling interno e nas estruturas de saída.

## Current Assets

- `scripts/hvac-rag/hvac_vision.py` já fala com `qwen2.5vl:3b` via Ollama.
- O módulo já reconhece tipos como `display`, `nameplate`, `label`, `wiring`, `error_log` e `pcb`.
- O estado derivado hoje para `pcb` é incompleto: só expõe defeitos visíveis e LEDs.
- Não há suíte de testes dedicada para visão HVAC.

## Decisions

- Reaproveitar `hvac_vision.py` em vez de criar novo pipeline paralelo.
- Priorizar primeiro o caso de uso com maior impacto técnico: foto de placa inverter/PCB.
- Todo output de `pcb` deve ser estruturado para consumo por tutor/memória sem parsing ad hoc.
- Testes devem cobrir heurística, prompt, parsing e state update antes de integração externa.

## Proposed Sequence

```text
04-01 contratos PCB/componentes
  -> 04-02 integração com estado/memória
  -> 04-03 intake/endpoint
  -> 04-04 smoke + runbook
```

## Out of Scope

- OCR avançado por modelo específico de fabricante
- Detecção visual fina de trilhas/solda por CV clássica
- Exposição de visão como modelo público no OpenWebUI
