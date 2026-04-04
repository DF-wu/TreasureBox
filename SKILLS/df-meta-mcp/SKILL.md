---
name: df-meta-mcp
description: Use DF MetaMCP via mcporter for GitHub repos/issues/PRs/code search/reviews/Copilot, TickTick tasks/projects, Context7 docs, DeepWiki repo Q&A, and Tavily web search.
homepage: https://metamcp.dfder.tw/metamcp/chatbot/mcp
metadata: {"clawdbot":{"requires":{"skills":["mcporter"],"bins":["python3","node","npm"]}}}
---

# df-meta-mcp

Use this skill when the task is best solved through **DF's MetaMCP endpoint** instead of local files or generic web search.

Assume the current working directory is the **skill root**. If it is not, replace paths like `scripts/dfmcp` or `references/...` with the actual installed path of this skill.

Do **not** use this skill for purely local filesystem, git, or shell work when built-in tools already cover the task. Reach for this skill when the task needs **remote services behind DF's MetaMCP endpoint**.

This endpoint currently exposes five high-value families plus one advanced helper:

- **GitHub** — repositories, issues, pull requests, comments, reviews, releases, branches, tags, code search, repo/user search, Copilot delegation/review, secret scanning.
- **TickTick** — tasks, projects, filtering, batch updates, completion, time-based queries.
- **Context7** — up-to-date library/framework docs and code examples.
- **DeepWiki** — repository wiki/topic structure, wiki contents, and repo-aware Q&A.
- **Tavily** — general web search / extraction / site-map style discovery for live web research.
- **Sequential Thinking** — an advanced planning / tool-orchestration helper for explicitly structured multi-step reasoning.

Do **not** load every reference file up front. Follow Lilac's progressive-disclosure style:

First, read **`REFERENCE.md`** for the invocation pattern. Next, open only the single family doc that matches the task. Finally, use the generated catalog file only when you need the exact tool inventory or required parameters.

## When to use this skill

Use it immediately for requests like these:

- "查某個 GitHub repo / issue / PR / release / branch / tag / commit」
- "幫我搜尋 GitHub 上的 repo / code / issue / PR / user」
- "幫我留言、review PR、合併 PR、請 Copilot 幫我做」
- "查某個框架 / 套件的最新文件或 API 範例」
- "根據某個 GitHub repo 回答架構 / 模組 / wiki 相關問題」
- "管理 TickTick 任務、專案、查今天/本週待辦、批量更新任務」

## Family routing

Choose the family file before making calls:

- **GitHub work** → `references/GITHUB.md`
- **TickTick task/project work** → `references/TICKTICK.md`
- **Framework/library docs, repo knowledge lookup, or general web search** → `references/DOCS_AND_RESEARCH.md`
- **Explicit stepwise planning / tool recommendation** → `references/SEQUENTIAL_THINKING.md`

For mutation-heavy work, read the matching family guide **before** calling write/update tools.

For the machine-generated live inventory, use:

- `references/catalog.generated.md`
- `references/github.generated.md`
- `references/ticktick.generated.md`
- `references/context7.generated.md`
- `references/deepwiki.generated.md`
- `references/tavily-hikari.generated.md`
- `references/sequentialthinking.generated.md`

## Default execution pattern

Use the wrapper script so you don't have to remember the full endpoint URL.

```bash
bash scripts/dfmcp list
bash scripts/dfmcp call github_mcp__search_repositories --args '{"query":"lilac mono"}' --output json
```

The wrapper uses **`mcporter` if it is already installed**, and otherwise falls back to **`npx -y mcporter`**.

Prefer `--output json` for machine-readable results. Prefer `--args '{...}'` whenever the tool takes arrays, nested objects, or booleans.

## High-signal selection rules

Keep these distinctions straight:

- **GitHub `list_*` vs `search_*`**: use `list_*` when you already know the repo; use `search_*` when searching across GitHub or when the query needs GitHub search syntax.
- **Read before write**: before mutating GitHub issues/PRs/files or TickTick tasks/projects, first fetch/list/search the target object unless the user already provided canonical IDs and exact values.
- **Resolve ambiguity first**: if multiple repos/tasks/issues could match, stop and disambiguate with a read/search step instead of guessing.
- **Issue/PR comments vs reviews**:
  - `add_issue_comment` = normal issue / PR conversation comment
  - `pull_request_review_write` = create/submit/delete a PR review
  - `add_comment_to_pending_review` = add a review comment to the latest pending review
  - `add_reply_to_pull_request_comment` = reply in an existing review-comment thread
- **Single-file vs multi-file writes**:
  - `create_or_update_file` = one file; existing-file updates need SHA
  - `push_files` = multiple files in one commit
- **Context7 flow**: normally call `context7__resolve-library-id` first, then `context7__query-docs`.
- **DeepWiki vs Context7**:
  - Context7 = external library/framework docs
  - DeepWiki = knowledge about a specific GitHub repository
- **Tavily** = generic live web search and extraction when the task is broader than package docs or a single repo.
- **Sequential Thinking** is optional and advanced. Use it only when explicit multi-step planning/tool recommendation is the task itself.

## Validation and failure handling

- Prefer `bash scripts/dfmcp call <tool> --output json` so results stay machine-readable.
- If a tool call fails, check the matching generated family file for required params and retry with a fully explicit `--args '{...}'` payload.
- If the task only needs one family, read only that family doc and its generated inventory. Do **not** load every generated file.

## Maintenance

This skill includes a catalog sync script. When the endpoint tool inventory changes, refresh it with:

```bash
python3 scripts/sync_catalog.py
```

That regenerates the family inventories under `references/*.generated.md` from the live endpoint.
