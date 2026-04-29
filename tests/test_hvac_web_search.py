import importlib.util
import pathlib
import re


ROOT = pathlib.Path(__file__).resolve().parents[1]
HVAC_DIR = ROOT / "scripts" / "hvac-rag"


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, HVAC_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_tavily_mcp_results_normalize_to_official_web():
    pipe = load_module("hvac_rag_pipe_for_web_test", "hvac_rag_pipe.py")
    pkg = pipe.build_retrieval_package(
        "Springer Sprint E1 inverter",
        [],
        {"has_error_codes": True, "has_hvac_components": True},
    )

    pipe.apply_web_results_to_package(
        pkg,
        [{
            "provider": "tavily_mcp",
            "confidence": 0.91,
            "title": "Springer Sprint manual tecnico",
            "url": "https://example.test/manual",
            "snippet": "Resultado externo para checagem.",
        }],
    )

    assert pkg["evidence_level"] == "official_web"
    assert pkg["web_provider"] == "tavily_mcp"
    assert pkg["web_confidence"] == 0.91
    assert pkg["web_context"][0]["title"] == "Springer Sprint manual tecnico"


def test_web_search_failure_falls_back_to_triagem_without_crash():
    pipe = load_module("hvac_rag_pipe_for_empty_web_test", "hvac_rag_pipe.py")
    pkg = pipe.build_retrieval_package(
        "Springer Sprint E1 inverter",
        [],
        {"has_error_codes": True, "has_hvac_components": True},
    )

    pipe.apply_web_results_to_package(pkg, [])

    assert pkg["evidence_level"] == "triagem_tecnica"
    assert pkg["web_provider"] is None
    assert pkg["web_context"] == []


def test_springer_sprint_does_not_activate_printable_route():
    pipe = load_module("hvac_rag_pipe_for_printable_test", "hvac_rag_pipe.py")

    assert pipe.is_printable_query("Springer Sprint erro E1 inverter") is False
    assert pipe.is_printable_query("imprimir checklist do Sprint E1") is True


def test_prompt_pt_br_has_no_cjk_or_cyrillic():
    pipe = load_module("hvac_rag_pipe_for_prompt_test", "hvac_rag_pipe.py")
    pkg = {
        "conversation_state": {"brand": "Springer", "family": "Sprint", "alarm_code": "E1"},
        "memory_context_str": "",
        "evidence_level": "official_web",
        "web_context": [{
            "provider": "tavily_mcp",
            "confidence": 0.8,
            "title": "Manual tecnico Springer Sprint",
            "snippet": "Checagem externa sobre ar-condicionado inverter.",
        }],
        "web_provider": "tavily_mcp",
        "web_confidence": 0.8,
        "manual_context": [],
        "safety_flags": [],
        "missing_info": [],
    }

    prompt = pipe.build_minimax_system_prompt(pkg)

    assert not re.search(r"[\u0400-\u04FF\u4E00-\u9FFF]", prompt)
    assert "checagem externa" in prompt
    assert "não como manual" in prompt
    assert "tavily" not in prompt.lower()


def test_final_response_charset_filter_removes_cjk_and_cyrillic():
    pipe = load_module("hvac_rag_pipe_for_charset_test", "hvac_rag_pipe.py")

    text = "Falha na placa 驱动板 e модуль inverter."
    cleaned = pipe.enforce_ptbr_charset(text)

    assert cleaned == "Falha na placa e inverter."


def test_unsupported_technical_values_are_suppressed_without_exact_manual():
    pipe = load_module("hvac_rag_pipe_for_values_test", "hvac_rag_pipe.py")

    text = "Meça 220 V e corrente de 12 A antes de trocar a placa."
    cleaned = pipe.suppress_unsupported_technical_values(text, "triagem_tecnica")

    assert "220 V" not in cleaned
    assert "12 A" not in cleaned
    assert "valor conforme etiqueta/manual" in cleaned


def test_exact_manual_keeps_technical_values():
    pipe = load_module("hvac_rag_pipe_for_manual_values_test", "hvac_rag_pipe.py")

    text = "Meça 220 V conforme tabela do manual."

    assert pipe.suppress_unsupported_technical_values(text, "manual_exato") == text


def test_tavily_mcp_payload_normalization():
    web = load_module("hvac_web_search_for_test", "hvac_web_search.py")
    payload = {
        "content": [{
            "type": "text",
            "text": '{"results":[{"title":"A","url":"https://example.test/a","content":"B","score":0.7}]}',
        }]
    }

    results = web._normalize_tavily_payload(payload)

    assert results == [{
        "provider": "tavily_mcp",
        "confidence": 0.7,
        "title": "A",
        "url": "https://example.test/a",
        "snippet": "B",
    }]
    assert hasattr(web, "search_web_ddg")


def test_default_provider_order_places_tavily_before_ddg():
    web = load_module("hvac_web_search_order_test", "hvac_web_search.py")

    order = [web.WEB_SEARCH_PROVIDER] + [
        provider for provider in web.WEB_SEARCH_FALLBACKS
        if provider != web.WEB_SEARCH_PROVIDER
    ]

    assert order.index("tavily") < order.index("ddg")


def test_tavily_runtime_options_are_env_configurable(monkeypatch):
    monkeypatch.setenv("TAVILY_SEARCH_DEPTH", "advanced")
    monkeypatch.setenv("TAVILY_MAX_RESULTS", "7")

    web = load_module("hvac_web_search_env_options_test", "hvac_web_search.py")

    assert web._tavily_search_depth() == "advanced"
    assert web._tavily_max_results() == 7


def test_tavily_runtime_options_default_to_safe_values(monkeypatch):
    monkeypatch.setenv("TAVILY_SEARCH_DEPTH", "unsupported")
    monkeypatch.setenv("TAVILY_MAX_RESULTS", "99")

    web = load_module("hvac_web_search_env_defaults_test", "hvac_web_search.py")

    assert web._tavily_search_depth() == "basic"
    assert web._tavily_max_results() == 10
