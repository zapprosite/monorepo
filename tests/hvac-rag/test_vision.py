"""VISION-01: PCB/component HVAC vision contracts."""


def test_classify_image_type_prefers_pcb_for_inverter_board_hints():
    import hvac_vision

    image_type = hvac_vision.classify_image_type(
        "data:image/jpeg;base64,ZmFrZQ==",
        ["placa inverter", "pcb", "led vermelho", "capacitor estufado"],
    )

    assert image_type == hvac_vision.ImageType.PCB


def test_build_vision_prompt_for_pcb_exposes_structured_fields():
    import hvac_vision

    prompt = hvac_vision.build_vision_prompt(
        hvac_vision.ImageType.PCB,
        ["placa da condensadora", "suspeita de IPM"],
    )

    assert '"image_type": "pcb"' in prompt
    assert '"board_type":' in prompt
    assert '"component_labels":' in prompt
    assert '"connector_pins":' in prompt
    assert '"led_status":' in prompt
    assert '"visible_defects":' in prompt


def test_parse_json_from_fenced_block():
    import hvac_vision

    parsed = hvac_vision._parse_json_from_response(
        'Resposta:\n```json\n{"image_type":"pcb","board_type":"inverter"}\n```'
    )

    assert parsed == {"image_type": "pcb", "board_type": "inverter"}


def test_state_update_from_pcb_includes_structured_fields():
    import hvac_vision

    update = hvac_vision.state_update_from_vision(
        {
            "image_type": "pcb",
            "error": None,
            "parsed": {
                "board_type": "inverter",
                "component_labels": ["IPM", "C102"],
                "connector_pins": ["CN1", "CN2"],
                "led_status": "vermelho piscando",
                "visible_defects": "capacitor estufado",
            },
        }
    )

    assert update["vision_image_type"] == "pcb"
    assert update["pcb_board_type"] == "inverter"
    assert update["pcb_component_labels"] == ["IPM", "C102"]
    assert update["pcb_connector_pins"] == ["CN1", "CN2"]
    assert update["pcb_led_status"] == "vermelho piscando"
    assert update["pcb_visible_defects"] == "capacitor estufado"
