---
name: df-meta-mcp
description: MetaMCP via scripts/dfmcp+mcporter — GitHub, TickTick, HackMD, Context7, DeepWiki, Tavily. Use when the user needs those logged-in APIs (issue/PR, task/habit, note, lib docs, repo wiki, web research); skip local repo/files and lone tools search.
homepage: https://metamcp.dfder.tw/metamcp/chatbot/mcp
metadata: {"clawdbot":{"requires":{"skills":["mcporter"],"bins":["python3","bash"]}}}
---

# df-meta-mcp

Stateless entry: endpoint defaults sit in `scripts/dfmcp` (`DF_METAMCP_ENDPOINT` / `DF_METAMCP_NAME` to override). No host `mcporter.json` required. Run commands from this skill root.

## Flow

`REFERENCE.md` → `references/ROUTING.md` (one family) → that family’s guide under `references/` → optional `*.generated.md` or `bash scripts/dfmcp list` / `schema` for params → `bash scripts/dfmcp call <tool> --args '{...}' --output json`.

Do not bulk-load all `*.generated.md` files.

## When / when not

Use for remote GitHub, TickTick, HackMD, Context7, DeepWiki, or Tavily behind the gateway. Skip for local workspace work (`read_file`, `grep`, `gh`, patches) or a single unauthenticated `tools search`.

## Failure

Retry with full `--args`; check `schema` or one generated tool entry; `bash scripts/dfmcp list` if the tool may have been renamed on the gateway.
