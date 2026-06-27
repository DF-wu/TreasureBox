from __future__ import annotations

from pathlib import Path


SCRIPTS_PATH = Path(__file__).resolve().parents[1] / "scripts.yaml"
CONFIGURATION_PATH = Path(__file__).resolve().parents[1] / "configuration.yaml"
COMPONENT_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "df_vits_bridge"
    / "__init__.py"
)


def test_configuration_enables_df_vits_bridge() -> None:
    content = CONFIGURATION_PATH.read_text(encoding="utf-8")

    assert "df_vits_bridge:" in content


def test_vits_script_calls_custom_generation_service() -> None:
    content = SCRIPTS_PATH.read_text(encoding="utf-8")

    assert "action: df_vits_bridge.generate" in content
    assert "response_variable: shell_response" in content


def test_custom_component_registers_generate_service() -> None:
    content = COMPONENT_PATH.read_text(encoding="utf-8")

    assert "async_register" in content
    assert 'DOMAIN = "df_vits_bridge"' in content
    assert '"generate"' in content
