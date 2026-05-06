"""VISION-04: smoke coverage for PCB/nameplate intake flow."""

import pytest


@pytest.mark.asyncio
async def test_extract_from_image_uses_mocked_vision_response(monkeypatch):
    import hvac_vision

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": (
                                '{"image_type":"pcb","board_type":"inverter",'
                                '"component_labels":["IPM","CN1"],'
                                '"connector_pins":["CN1"],'
                                '"led_status":"verde aceso",'
                                '"visible_defects":null}'
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20},
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(hvac_vision.httpx, "AsyncClient", FakeAsyncClient)

    result = await hvac_vision.extract_from_image(
        "data:image/png;base64,ZmFrZQ==",
        ["placa inverter", "IPM"],
    )
    state = hvac_vision.state_update_from_vision(result)

    assert result["error"] is None
    assert result["image_type"] == "pcb"
    assert state["pcb_board_type"] == "inverter"
    assert state["pcb_component_labels"] == ["IPM", "CN1"]
    assert state["pcb_connector_pins"] == ["CN1"]


def test_fixture_images_are_documented_placeholders():
    from pathlib import Path

    fixture_dir = Path("/srv/monorepo/fixtures/vision")

    assert (fixture_dir / "pcb-lg.txt").read_text(encoding="utf-8").startswith("Fixture:")
    assert (fixture_dir / "pcb-samsung.txt").read_text(encoding="utf-8").startswith("Fixture:")
    assert (fixture_dir / "model-label.txt").read_text(encoding="utf-8").startswith("Fixture:")
