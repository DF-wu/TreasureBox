from __future__ import annotations

import os
import subprocess
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "bin" / "df-room-vits-generate.sh"


def run_script(
    tmp_path: Path, message: str, lang: str, speaker: str
) -> subprocess.CompletedProcess[str]:
    fake_binary = tmp_path / "fake-vits.sh"
    output_path = tmp_path / "out.wav"
    capture_path = tmp_path / "args.txt"
    _ = fake_binary.write_text(
        (
            "#!/bin/sh\n"
            'printf \'%s\\n\' "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$8" > "$CAPTURE_PATH"\n'
            'touch "$8"\n'
        ),
        encoding="utf-8",
    )
    fake_binary.chmod(0o755)

    environment = os.environ.copy()
    environment["VITS_BIN"] = str(fake_binary)
    environment["CAPTURE_PATH"] = str(capture_path)

    return subprocess.run(
        ["sh", str(SCRIPT_PATH), message, lang, speaker, str(output_path)],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )


def test_shell_wrapper_strips_metadata_and_mention(tmp_path: Path) -> None:
    result = run_script(
        tmp_path,
        '<LILAC_META:v1>{"source":"discord"}</LILAC_META:v1>\n@df_chatbot\n今晚十點關燈',
        "zh",
        "",
    )

    assert result.returncode == 0
    captured = (tmp_path / "args.txt").read_text(encoding="utf-8").splitlines()
    assert captured == [
        "-t",
        "今晚十點關燈",
        "-s",
        "云堇",
        "-l",
        "zh",
        "-o",
        str(tmp_path / "out.wav"),
    ]


def test_shell_wrapper_keeps_explicit_speaker_for_mix(tmp_path: Path) -> None:
    result = run_script(tmp_path, "今日は静かにして", "mix", "custom-voice")

    assert result.returncode == 0
    captured = (tmp_path / "args.txt").read_text(encoding="utf-8").splitlines()
    assert captured[3] == "custom-voice"
    assert captured[5] == "mix"


def test_shell_wrapper_uses_japanese_default_speaker(tmp_path: Path) -> None:
    result = run_script(tmp_path, "おはよう", "ja", "")

    assert result.returncode == 0
    captured = (tmp_path / "args.txt").read_text(encoding="utf-8").splitlines()
    assert captured[3] == "ayaka"


def test_shell_wrapper_rejects_empty_message_after_sanitization(tmp_path: Path) -> None:
    result = run_script(
        tmp_path, "<LILAC_META:v1>{}</LILAC_META:v1>\n@df_chatbot\n", "zh", ""
    )

    assert result.returncode == 2
    assert result.stderr.strip() == "message is empty after sanitization"


def test_shell_wrapper_strips_json_quotes_from_ha_payload(tmp_path: Path) -> None:
    result = run_script(
        tmp_path,
        '"<LILAC_META:v1>{\\"source\\":\\"discord\\"}</LILAC_META:v1>\\n@df_chatbot\\n今晚十點關燈"',
        '"zh"',
        '""',
    )

    assert result.returncode == 0
    captured = (tmp_path / "args.txt").read_text(encoding="utf-8").splitlines()
    assert captured == [
        "-t",
        "今晚十點關燈",
        "-s",
        "云堇",
        "-l",
        "zh",
        "-o",
        str(tmp_path / "out.wav"),
    ]


def test_shell_wrapper_accepts_environment_transport(tmp_path: Path) -> None:
    fake_binary = tmp_path / "fake-vits-env.sh"
    output_path = tmp_path / "env-out.wav"
    capture_path = tmp_path / "env-args.txt"
    _ = fake_binary.write_text(
        (
            "#!/bin/sh\n"
            'printf \'%s\\n\' "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$8" > "$CAPTURE_PATH"\n'
            'touch "$8"\n'
        ),
        encoding="utf-8",
    )
    fake_binary.chmod(0o755)

    environment = os.environ.copy()
    environment["VITS_BIN"] = str(fake_binary)
    environment["CAPTURE_PATH"] = str(capture_path)
    environment["VITS_TEXT"] = (
        '"<LILAC_META:v1>{\\"source\\":\\"discord\\"}</LILAC_META:v1>\\n@df_chatbot\\n今晚十點關燈"'
    )
    environment["VITS_LANG"] = '"zh"'
    environment["VITS_SPEAKER"] = '""'
    environment["VITS_OUTPUT"] = str(output_path)

    result = subprocess.run(
        ["sh", str(SCRIPT_PATH)],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )

    assert result.returncode == 0
    captured = capture_path.read_text(encoding="utf-8").splitlines()
    assert captured == [
        "-t",
        "今晚十點關燈",
        "-s",
        "云堇",
        "-l",
        "zh",
        "-o",
        str(output_path),
    ]


def test_shell_wrapper_trims_whitespace_around_ha_scalars(tmp_path: Path) -> None:
    result = run_script(
        tmp_path,
        "  今天會下雨  ",
        "  ja  ",
        "  custom-voice  ",
    )

    assert result.returncode == 0
    captured = (tmp_path / "args.txt").read_text(encoding="utf-8").splitlines()
    assert captured == [
        "-t",
        "今天會下雨",
        "-s",
        "custom-voice",
        "-l",
        "ja",
        "-o",
        str(tmp_path / "out.wav"),
    ]
