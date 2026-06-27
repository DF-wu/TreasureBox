#!/usr/bin/env python3

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import cast


DEFAULT_OUTPUT = "/media/vits/df-room-latest.wav"
DEFAULT_LANG = "zh"
DEFAULT_ZH_SPEAKER = "云堇"
DEFAULT_JA_SPEAKER = "ayaka"
METADATA_PREFIX = "<LILAC_META:v1>"
MENTION_MARKER = "@df_chatbot"


def sanitize_message(raw_message: str) -> str:
    cleaned_lines: list[str] = []
    for original_line in raw_message.splitlines():
        stripped_line = original_line.strip()
        if stripped_line.startswith(METADATA_PREFIX):
            continue
        if stripped_line == MENTION_MARKER:
            continue
        cleaned_lines.append(original_line)

    return "\n".join(cleaned_lines).strip()


def resolve_lang(lang: str) -> str:
    candidate = lang.strip() if lang else ""
    return candidate or DEFAULT_LANG


def resolve_speaker(lang: str, speaker: str) -> str:
    explicit_speaker = speaker.strip() if speaker else ""
    if explicit_speaker:
        return explicit_speaker

    if resolve_lang(lang) == "ja":
        return DEFAULT_JA_SPEAKER

    return DEFAULT_ZH_SPEAKER


def build_command(
    *,
    binary_path: str,
    raw_message: str,
    lang: str,
    speaker: str,
    output_path: str,
) -> list[str]:
    clean_message = sanitize_message(raw_message)
    if not clean_message:
        raise ValueError("message is empty after sanitization")

    resolved_lang = resolve_lang(lang)
    resolved_speaker = resolve_speaker(resolved_lang, speaker)

    return [
        binary_path,
        "-t",
        clean_message,
        "-s",
        resolved_speaker,
        "-l",
        resolved_lang,
        "-o",
        output_path,
        "-q",
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Home Assistant VITS room broadcast audio"
    )
    _ = parser.add_argument("--text", required=True, help="Raw message content")
    _ = parser.add_argument("--lang", default=DEFAULT_LANG, help="Language code")
    _ = parser.add_argument("--speaker", default="", help="Explicit speaker override")
    _ = parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output WAV path")
    _ = parser.add_argument(
        "--binary", default="/config/bin/vits-tts", help="VITS CLI path"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    binary = cast(str, args.binary)
    text = cast(str, args.text)
    lang = cast(str, args.lang)
    speaker = cast(str, args.speaker)
    output = cast(str, args.output)

    command = build_command(
        binary_path=binary,
        raw_message=text,
        lang=lang,
        speaker=speaker,
        output_path=output,
    )

    Path(output).parent.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(command, check=False)
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
