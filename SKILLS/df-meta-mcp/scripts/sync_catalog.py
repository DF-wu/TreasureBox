#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ENDPOINT = "https://metamcp.dfder.tw/metamcp/chatbot/mcp"
NAME = "dfmcp"

FAMILY_TITLES = {
    "github_mcp": "GitHub",
    "ticktick": "TickTick",
    "context7": "Context7",
    "deepwiki": "DeepWiki",
    "mcp-sequentialthinking-tools": "Sequential Thinking",
}


def main() -> int:
    skill_root = Path(__file__).resolve().parent.parent
    references_dir = skill_root / "references"
    references_dir.mkdir(parents=True, exist_ok=True)

    mcporter = shutil_which("mcporter")
    if not mcporter:
        raise SystemExit("mcporter not found in PATH")

    result = subprocess.run(
        [
            "bun",
            mcporter,
            "list",
            "--http-url",
            ENDPOINT,
            "--name",
            NAME,
            "--json",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    data = json.loads(result.stdout)
    (references_dir / "catalog.raw.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    tools = data.get("tools", [])
    grouped: dict[str, list[dict[str, Any]]] = {}
    for tool in tools:
        family = tool_family(tool["name"])
        grouped.setdefault(family, []).append(tool)

    summary_lines = [
        "# MetaMCP live catalog",
        "",
        f"- Endpoint: `{ENDPOINT}`",
        f"- Tool count: **{len(tools)}**",
        "",
        "## Families",
        "",
    ]

    for family in sorted(grouped):
        tools_for_family = sorted(grouped[family], key=lambda t: t["name"])
        title = FAMILY_TITLES.get(family, family)
        generated_name = generated_file_name(family)
        summary_lines.append(
            f"- **{title}** (`{family}`) — {len(tools_for_family)} tools → `{generated_name}`"
        )
        write_family_doc(references_dir / generated_name, family, title, tools_for_family)

    summary_lines.extend(
        [
            "",
            "## Notes",
            "",
            "- This file is generated from the live endpoint via `scripts/sync_catalog.py`.",
            "- Read the family-specific generated file when you need exact tool names, summaries, required parameters, or constraint notes.",
        ]
    )
    (references_dir / "catalog.generated.md").write_text(
        "\n".join(summary_lines) + "\n", encoding="utf-8"
    )

    print(f"Wrote live catalog for {len(tools)} tools to {references_dir}")
    return 0


def generated_file_name(family: str) -> str:
    mapping = {
        "github_mcp": "github.generated.md",
        "ticktick": "ticktick.generated.md",
        "context7": "context7.generated.md",
        "deepwiki": "deepwiki.generated.md",
        "mcp-sequentialthinking-tools": "sequentialthinking.generated.md",
    }
    return mapping.get(family, re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-") + ".generated.md")


def tool_family(name: str) -> str:
    if "__" in name:
        return name.split("__", 1)[0]
    return name.split("_", 1)[0]


def first_line(text: str) -> str:
    for line in text.splitlines():
        line = " ".join(line.split()).strip()
        if line:
            return line
    return ""


def important_notes(text: str) -> list[str]:
    notes: list[str] = []
    for raw in text.splitlines():
        line = " ".join(raw.split()).strip()
        if not line:
            continue
        upper = line.upper()
        if any(token in upper for token in ["IMPORTANT", "MUST", "UNLESS", "DO NOT", "MAXIMUM", "MAX "]):
            notes.append(line)
    deduped: list[str] = []
    seen = set()
    for note in notes:
        if note in seen:
            continue
        seen.add(note)
        deduped.append(note)
    return deduped[:3]


def required_params(tool: dict[str, Any]) -> list[str]:
    schema = tool.get("inputSchema") or {}
    required = schema.get("required") or []
    if isinstance(required, list):
        return [str(x) for x in required]
    return []


def optional_params(tool: dict[str, Any], limit: int = 8) -> list[str]:
    schema = tool.get("inputSchema") or {}
    props = schema.get("properties") or {}
    if not isinstance(props, dict):
        return []
    required = set(required_params(tool))
    optionals = [k for k in props.keys() if k not in required]
    return optionals[:limit]


def write_family_doc(path: Path, family: str, title: str, tools: list[dict[str, Any]]) -> None:
    lines = [
        f"# {title} live inventory",
        "",
        f"- Family key: `{family}`",
        f"- Tool count: **{len(tools)}**",
        "",
        "> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.",
        "",
    ]

    for tool in tools:
        name = tool.get("name", "")
        summary = first_line(tool.get("description", "")) or "(no description)"
        req = required_params(tool)
        opt = optional_params(tool)
        notes = important_notes(tool.get("description", ""))

        lines.append(f"## `{name}`")
        lines.append("")
        lines.append(f"- **What it does:** {summary}")
        lines.append(
            f"- **Required params:** {', '.join(f'`{x}`' for x in req) if req else '(none)'}"
        )
        if opt:
            lines.append(f"- **Optional params (first {len(opt)}):** {', '.join(f'`{x}`' for x in opt)}")
        if notes:
            lines.append("- **Important notes:**")
            for note in notes:
                lines.append(f"  - {note}")
        lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def shutil_which(name: str) -> str | None:
    paths = os.environ.get("PATH", "").split(os.pathsep)
    for base in paths:
        candidate = Path(base) / name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


if __name__ == "__main__":
    sys.exit(main())