# Runbook: Fluxo de Diagnóstico Visual HVAC

## Objetivo

Validar fotos de placa, etiqueta e display antes de usar o resultado no diagnóstico do tutor HVAC.

## Como Fotografar

- Use boa iluminação e foco na área com serigrafia, conectores, LEDs ou etiqueta.
- Para PCB, capture a placa inteira e depois uma foto aproximada da região suspeita.
- Para etiqueta, mantenha modelo, tensão, refrigerante e número de série legíveis.
- Não fotografe equipamento energizado se houver risco de alta tensão exposta.

## Execução

```bash
python3 scripts/hvac-rag/hvac_vision.py --image fixtures/vision/pcb-lg.txt --hint "placa inverter" --type pcb --json
pytest tests/hvac-rag/test_vision_pipeline.py
```

## Resultado Esperado

- `image_type` identifica `pcb`, `nameplate`, `display` ou outro tipo suportado.
- Para PCB, o estado inclui `pcb_board_type`, `pcb_component_labels`, `pcb_connector_pins`, `pcb_led_status` e `pcb_visible_defects` quando visíveis.
- O estado de sessão recebe apenas campos extraídos ou inferidos com segurança.

## Uso no Diagnóstico

- Labels e pinos orientam a próxima pergunta do tutor, mas não substituem o manual do modelo.
- Defeitos visuais são tratados como indício, não como diagnóstico final.
- Valores elétricos só podem ser citados quando estiverem no manual ou na etiqueta fotografada.
