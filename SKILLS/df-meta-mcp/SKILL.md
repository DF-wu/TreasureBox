---
name: df-meta-mcp
description: Live dfmcp MetaMCP (116 tools)—github_mcp__*, ticktick__*, hackmd__*, context7__*, deepwiki__*, tavily-hikari__* via scripts/dfmcp. GitHub issue/PR/file, TickTick task/habit, HackMD note, lib docs, repo wiki, Tavily web—not local gh/files.
homepage: https://metamcp.dfder.tw/metamcp/chatbot/mcp
metadata: {"clawdbot":{"requires":{"skills":["mcporter"],"bins":["python3","bash"]}}}
---

# df-meta-mcp

Tools are **`family__suffix`** on the wire (e.g. `github_mcp__pull_request_read`, `ticktick__list_undone_tasks_by_time_query`, `hackmd__search-notes`). Pick tool from the family guides in `references/`; params from `references/*.generated.md` (live snapshot: `bash scripts/dfmcp refresh`).

## Flow

`REFERENCE.md` → `ROUTING.md` → one of `GITHUB.md` / `TICKTICK.md` / `HACKMD.md` / `DOCS_AND_RESEARCH.md` / `SEQUENTIAL_THINKING.md` → `bash scripts/dfmcp call <full_name> --args '{...}' --output json`.

## Skip

Local workspace (`read_file`, `grep`, `gh`). Use when the task maps to a tool listed in `catalog.generated.md`.

## Failure

`catalog.generated.md` or `bash scripts/dfmcp list` for names; one tool section in `*.generated.md` for args.
