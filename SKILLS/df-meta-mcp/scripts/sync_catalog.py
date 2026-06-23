#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

DEFAULT_ENDPOINT = "https://metamcp.dfder.tw/metamcp/chatbot/mcp"
DEFAULT_NAME = "dfmcp"
FAMILY_TITLES = {
    "github_mcp": "GitHub",
    "ticktick": "TickTick",
    "context7": "Context7",
    "deepwiki": "DeepWiki",
    "hackmd": "HackMD",
    "tavily-hikari": "Tavily",
    "mcp-sequentialthinking-tools": "Sequential Thinking",
}


def main() -> int:
    endpoint = os.environ.get("DF_METAMCP_ENDPOINT", DEFAULT_ENDPOINT)
    name = os.environ.get("DF_METAMCP_NAME", DEFAULT_NAME)
    skill_root = Path(__file__).resolve().parent.parent
    references_dir = skill_root / "references"
    references_dir.mkdir(parents=True, exist_ok=True)

    tools = fetch_tools(endpoint=endpoint, name=name)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for tool in tools:
        family = tool_family(str(tool.get("name", "")))
        grouped.setdefault(family, []).append(tool)

    summary_lines = [
        "# MetaMCP live catalog",
        "",
        f"- Endpoint: `{endpoint}`",
        f"- Tool count: **{len(tools)}**",
        "",
        "## Families",
        "",
    ]

    for family in sorted(grouped):
        tools_for_family = sorted(grouped[family], key=lambda t: str(t.get("name", "")))
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
        "\n".join(summary_lines) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote live catalog for {len(tools)} tools to {references_dir}")
    return 0


def fetch_tools(*, endpoint: str, name: str) -> list[dict[str, Any]]:
    mcporter_cmd = resolve_mcporter_cmd()
    skill_root = Path(__file__).resolve().parent.parent
    output_path = skill_root / ".tmp.mcporter-list.json"
    try:
        with output_path.open("w", encoding="utf-8") as handle:
            subprocess.run(
                [*mcporter_cmd, "list", "--http-url", endpoint, "--name", name, "--json"],
                check=True,
                stdout=handle,
                text=True,
            )
        data = json.loads(output_path.read_text(encoding="utf-8"))
    finally:
        output_path.unlink(missing_ok=True)
    tools = data.get("tools", [])
    if not isinstance(tools, list):
        raise SystemExit("Unexpected mcporter list JSON: missing tools array")
    normalized: list[dict[str, Any]] = []
    for item in tools:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def generated_file_name(family: str) -> str:
    mapping = {
        "github_mcp": "github.generated.md",
        "ticktick": "ticktick.generated.md",
        "context7": "context7.generated.md",
        "deepwiki": "deepwiki.generated.md",
        "mcp-sequentialthinking-tools": "sequentialthinking.generated.md",
    }
    return mapping.get(
        family,
        re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-") + ".generated.md",
    )


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
    optionals = [str(key) for key in props.keys() if key not in required]
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
        name = str(tool.get("name", ""))
        summary = first_line(str(tool.get("description", ""))) or "(no description)"
        req = required_params(tool)
        opt = optional_params(tool)
        notes = important_notes(str(tool.get("description", "")))

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
    for base in os.environ.get("PATH", "").split(os.pathsep):
        if not base:
            continue
        candidate = Path(base) / name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def resolve_mcporter_cmd() -> list[str]:
    mcporter = shutil_which("mcporter")
    if mcporter:
        return [mcporter]
    if shutil_which("bunx"):
        return ["bunx", "-y", "mcporter"]
    if shutil_which("npx"):
        return ["npx", "-y", "mcporter"]
    raise SystemExit("Neither mcporter, bunx, nor npx is available in PATH")


if __name__ == "__main__":
    sys.exit(main())
