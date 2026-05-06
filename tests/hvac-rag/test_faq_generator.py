"""FAQ-01: structured FAQ generation helpers."""


def test_fallback_extractive_faq_uses_manual_text():
    import hvac_faq_generator

    text = (
        "Manual de serviço.\n\n"
        "Erro CH05 indica falha de comunicação entre evaporadora e condensadora. "
        "Verifique cabo, placa e segurança antes de testar tensão."
    )

    faq = hvac_faq_generator.generate_faq(text, limit=1)

    assert len(faq) == 1
    assert "question" in faq[0]
    assert "CH05" in faq[0]["answer"]


def test_parse_faq_json_ignores_invalid_items():
    import hvac_faq_generator

    parsed = hvac_faq_generator.parse_faq_json(
        'texto [{"question":"Como testar?","answer":"Siga o manual.","source_excerpt":"x"}, {"bad": true}]'
    )

    assert parsed == [{"question": "Como testar?", "answer": "Siga o manual.", "source_excerpt": "x"}]
