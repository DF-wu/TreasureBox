from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Protocol, cast


class GeneratorModule(Protocol):
    def build_command(
        self,
        *,
        binary_path: str,
        raw_message: str,
        lang: str,
        speaker: str,
        output_path: str,
    ) -> list[str]: ...


MODULE_PATH = Path(__file__).resolve().parents[1] / "bin" / "df_room_vits_generate.py"
SPEC = importlib.util.spec_from_file_location("df_room_vits_generate", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
RAW_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RAW_MODULE)
MODULE = cast(GeneratorModule, cast(object, RAW_MODULE))


def test_build_command_strips_discord_metadata_and_mention_marker() -> None:
    command = MODULE.build_command(
        binary_path="/config/bin/vits-tts",
        raw_message='<LILAC_META:v1>{"source":"discord"}</LILAC_META:v1>\n@df_chatbot\n今晚十點關燈',
        lang="zh",
        speaker="",
        output_path="/media/vits/df-room-latest.wav",
    )

    assert command == [
        "/config/bin/vits-tts",
        "-t",
        "今晚十點關燈",
        "-s",
        "云堇",
        "-l",
        "zh",
        "-o",
        "/media/vits/df-room-latest.wav",
        "-q",
    ]


def test_build_command_preserves_explicit_speaker_and_mix_language() -> None:
    command = MODULE.build_command(
        binary_path="/config/bin/vits-tts",
        raw_message="今日は静かにして",
        lang="mix",
        speaker="custom-voice",
        output_path="/tmp/out.wav",
    )

    assert command[2] == "今日は静かにして"
    assert command[4] == "custom-voice"
    assert command[6] == "mix"


def test_build_command_uses_japanese_default_speaker() -> None:
    command = MODULE.build_command(
        binary_path="/config/bin/vits-tts",
        raw_message="おはよう",
        lang="ja",
        speaker="",
        output_path="/tmp/out.wav",
    )

    assert command[4] == "ayaka"


def test_build_command_rejects_empty_message_after_sanitization() -> None:
    try:
        _ = MODULE.build_command(
            binary_path="/config/bin/vits-tts",
            raw_message="<LILAC_META:v1>{}</LILAC_META:v1>\n@df_chatbot\n",
            lang="zh",
            speaker="",
            output_path="/tmp/out.wav",
        )
    except ValueError as error:
        assert str(error) == "message is empty after sanitization"
    else:
        raise AssertionError("expected ValueError for empty sanitized message")
