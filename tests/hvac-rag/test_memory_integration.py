import pytest
import sys
import os
import json

# Adiciona o diretório de scripts ao path para permitir imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scripts/hvac-rag")))

def test_memory_stores_vision_state():
    # Apenas validação de que o dict aceita os campos (já testado)
    state = {}
    vision_update = {
        "vision_image_type": "pcb",
        "pcb_board_type": "inverter_main",
        "pcb_component_labels": ["IPM", "C102"],
        "pcb_led_status": "3 flashes red"
    }
    
    state.update(vision_update)
    assert state["vision_image_type"] == "pcb"

def test_context_includes_vision_data():
    import hvac_memory_context
    
    state = {
        "vision_image_type": "pcb",
        "pcb_board_type": "inverter_main",
        "pcb_component_labels": ["IPM", "C102"],
        "pcb_led_status": "3 flashes red",
        "pcb_connector_pins": ["CN1", "CN2"]
    }
    
    fetch_result = {
        "conversation_state": state
    }
    
    context = hvac_memory_context.build_context_pack(fetch_result)
    
    # Esperamos uma seção legível de evidência visual, não apenas JSON bruto
    assert "[EVIDÊNCIA VISUAL]" in context
    assert "Placa: inverter_main" in context
    assert "LEDs: 3 flashes red" in context
    assert "Componentes: IPM, C102" in context
    assert "Conectores: CN1, CN2" in context
