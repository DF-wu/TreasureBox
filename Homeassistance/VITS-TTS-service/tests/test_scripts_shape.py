from __future__ import annotations

from pathlib import Path


SCRIPTS_PATH = Path(__file__).resolve().parents[1] / "scripts.yaml"


def test_edge_script_supports_selectable_media_players() -> None:
    content = SCRIPTS_PATH.read_text(encoding="utf-8")
    edge_section = content.split("df_room_say_edge:", 1)[1].split(
        "df_room_say_vits:", 1
    )[0]

    assert "media_players:" in edge_section
    assert "target_media_players:" in edge_section
    assert "for_each: '{{ target_media_players }}'" in edge_section


def test_vits_script_uses_unique_output_filename_per_run() -> None:
    content = SCRIPTS_PATH.read_text(encoding="utf-8")

    assert "output_filename:" in content
    assert "context.id" in content
    assert "output_path:" in content
    assert "media_source_path:" in content
    assert "playback_url:" in content
    assert "response_variable: shell_response" in content


def test_vits_script_plays_generated_run_specific_media_path() -> None:
    content = SCRIPTS_PATH.read_text(encoding="utf-8")

    assert "output: '{{ output_path }}'" in content
    assert "media_content_id: '{{ playback_url }}'" in content
    assert "df-room-latest.wav" not in content
    assert "192.168.11.201:8123/media/local/vits/" in content


def test_vits_script_stops_when_generation_fails() -> None:
    content = SCRIPTS_PATH.read_text(encoding="utf-8")

    assert 'shell_response["returncode"]' in content
    assert "stop: VITS generation failed" in content
