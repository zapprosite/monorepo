---
plan: 04-04
status: complete
completed: 2026-05-06
---

# Plan 04-04 Summary - Smoke Tests de Visão e Runbook

## Mudanças Realizadas

- Criado `tests/hvac-rag/test_vision_pipeline.py` com smoke unitário do pipeline de visão usando mock de LiteLLM/Qwen.
- Criados placeholders versionáveis em `fixtures/vision/` para PCB LG, PCB Samsung e etiqueta de modelo.
- Criado `docs/RUNBOOKS/VISION-DIAGNOSTIC-FLOW.md` com fluxo operacional em PT-BR.

## Verificação

```bash
pytest tests/hvac-rag/test_vision.py tests/hvac-rag/test_vision_pipeline.py
```

Resultado: testes passaram.

## Desvios do Plano

As fixtures versionadas são placeholders textuais. Fotos reais de campo devem ficar fora do Git quando contiverem dados de cliente, serial ou ambiente.

## Self-Check: PASSED
