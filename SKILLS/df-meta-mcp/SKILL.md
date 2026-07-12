---
name: df-meta-mcp
description: Route agent work to DF MetaMCP (GitHub, TickTick habits/tasks/focus, HackMD, Context7, DeepWiki, Tavily, sequential thinking) via scripts/dfmcp and mcporter. Use when the task needs authenticated remote APIs behind metamcp.dfder.tw—not local bash/gh or generic tools search alone.
homepage: https://metamcp.dfder.tw/metamcp/chatbot/mcp
metadata: {"clawdbot":{"requires":{"skills":["mcporter"],"bins":["python3","bash"]}}}
---

# df-meta-mcp

Thin router over **DF MetaMCP** for lilac-mono / OpenClaw-style agents. The endpoint aggregates multiple MCP backends; this skill keeps **context small** (manual family guides + on-demand generated inventories) while exposing a single invocation path.

**Default endpoint:** `https://metamcp.dfder.tw/metamcp/chatbot/mcp`  
**Wrapper:** `scripts/dfmcp` (always pass ad-hoc `--http-url`; no required `mcporter.json` on the host)  
**Live tool inventory:** regenerate with `bash scripts/dfmcp refresh` → `references/catalog.generated.md` and `references/*.generated.md`

Run all commands from the **skill root** (the directory containing this `SKILL.md`). If installed elsewhere, prefix paths accordingly.

## When to use (and when not to)

**Use this skill when:**

- GitHub API work (issues, PRs, reviews, releases, code/repo search, remote file read/write in a repo).
- TickTick (tasks, projects, habits, focus/pomodoro, tags, columns, batch ops, date/time queries).
- HackMD (personal or team notes).
- Library/framework docs (Context7) or repo-specific wiki/Q&A (DeepWiki).
- Live web research beyond a single quick fact (Tavily).
- You need the **current** tool list or JSON schema from the live gateway.

**Do not use this skill when:**

- The job is local repo inspection, patching, or tests → use `bash`, `read_file`, `grep`, `gh` in the workspace.
- A single built-in `tools search` / `tools fetch` suffices and no auth-backed SaaS is involved.
- You are tempted to paste the entire generated catalog into the model context—**read one family file instead**.

## Live surface (refresh after MetaMCP changes)

After `bash scripts/dfmcp refresh`, treat **`references/catalog.generated.md`** as authoritative for family names, tool counts, and links to per-family inventories. As of the last sync in this repo, the gateway exposes **7 families / 116 tools**: GitHub (44), TickTick (47), HackMD (14), Tavily (5), DeepWiki (3), Context7 (2), Sequential Thinking (1). Your server may differ—**refresh before assuming counts**.

Tool names on the wire use the MetaMCP prefix form, e.g. `github_mcp__get_me`, `ticktick__list_projects`, `hackmd__get-note`.

## Progressive disclosure (required)

1. Read **`REFERENCE.md`** once per task class (how to call, JSON conventions).
2. Open **one** manual family guide under `references/` (routing table below).
3. Open the matching **`*.generated.md`** only if you need exact required params or tool names.
4. Call tools via **`bash scripts/dfmcp call <tool> --args '{...}' --output json`**.

Never load all `references/*.generated.md` files into context.

## Family routing

| Intent | Manual guide | Generated inventory |
| --- | --- | --- |
| GitHub repos, issues, PRs, search, releases, files | `references/GITHUB.md` | `references/github.generated.md` |
| TickTick tasks, projects, habits, focus, tags | `references/TICKTICK.md` | `references/ticktick.generated.md` |
| HackMD notes / teams | `references/HACKMD.md` | `references/hackmd.generated.md` |
| Package docs, repo wiki, web research | `references/DOCS_AND_RESEARCH.md` | `context7`, `deepwiki`, `tavily-hikari` generated files |
| Meta planning across tools | `references/SEQUENTIAL_THINKING.md` | `references/sequentialthinking.generated.md` |

For **any write/update/delete**, read the family guide first unless the user supplied canonical IDs and unambiguous targets.

## Invocation defaults

```bash
bash scripts/dfmcp schema          # tool list + schemas (heavy; use sparingly)
bash scripts/dfmcp call github_mcp__get_me --output json
bash scripts/dfmcp call ticktick__list_projects --output json
bash scripts/dfmcp call context7__resolve-library-id --args '{"libraryName":"bun","query":"test runner"}' --output json
```

- Prefer **`--output json`** for parsing.
- Prefer **`--args '{...}'`** for objects, arrays, and booleans.
- Override endpoint/name for staging: `DF_METAMCP_ENDPOINT=... DF_METAMCP_NAME=... bash scripts/dfmcp list`.

`mcporter` resolution order: `mcporter` on `PATH` → `bunx -y mcporter` → `npx -y mcporter`.

## Cross-family rules (high signal)

- **GitHub:** `list_*` / `issue_read` / `pull_request_read` when `owner/repo` is known; `search_*` for cross-repo discovery. Remote file update: `create_or_update_file` needs **`sha`** for existing paths; multi-file: `push_files`. PR conversation vs review: `add_issue_comment` vs `pull_request_review_write` vs `add_comment_to_pending_review` vs `add_reply_to_pull_request_comment`. Copilot on this gateway: **`github_mcp__request_copilot_review`** (there is no assign/create-PR-with-copilot job API in the current inventory).
- **TickTick:** tasks vs **habits** vs **focus** are separate tool groups; use `get_user_preference` when timezone matters; `list_undone_tasks_by_date` max **14-day** range; `complete_tasks_in_project` max **20** task IDs per call.
- **Context7:** `context7__resolve-library-id` before `context7__query-docs` unless the user gave a `/org/project` library id; respect per-question call limits in tool descriptions.
- **DeepWiki** = one GitHub repo’s wiki/knowledge; **Context7** = third-party library docs; **Tavily** = open web.
- **Sequential thinking:** only when you deliberately need branching step metadata and an explicit `available_mcp_tools` list—not for routine lookups.

## Failure handling

1. Re-read required params in the family `*.generated.md` entry.
2. Retry with fully explicit `--args` (no bare key=value for nested fields).
3. If the tool is missing, run `bash scripts/dfmcp refresh` and re-check `catalog.generated.md` (MetaMCP may have added/removed servers).
4. Do not leak tokens or raw auth errors into user-visible chat; summarize the failure and next step.

## Maintainer

Operators updating MetaMCP should run `bash scripts/dfmcp refresh` in this skill directory and commit the updated `references/*.generated.md` so agents stay aligned with production.
