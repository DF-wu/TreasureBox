# REFERENCE

Operational quick-start for **DF MetaMCP**. Commands assume the **skill root** as cwd.

## Endpoint and wrapper

| Item | Value |
| --- | --- |
| URL | `https://metamcp.dfder.tw/metamcp/chatbot/mcp` |
| Logical mcporter name | `dfmcp` (label only; wrapper passes `--http-url` every time) |
| Entry script | `scripts/dfmcp` |

Overrides:

```bash
DF_METAMCP_ENDPOINT='https://example.com/mcp' DF_METAMCP_NAME=staging bash scripts/dfmcp list
```

`mcporter` binary: `PATH` → `bunx -y mcporter` → `npx -y mcporter`.

## Commands

```bash
bash scripts/dfmcp list              # tool names (lighter than --schema)
bash scripts/dfmcp schema            # full JSON schemas (heavy)
bash scripts/dfmcp call <tool> --args '<json>' --output json
bash scripts/dfmcp refresh           # sync references/*.generated.md from live gateway
python3 scripts/sync_catalog.py      # same as refresh
```

### Call examples

```bash
bash scripts/dfmcp call github_mcp__get_me --output json
bash scripts/dfmcp call github_mcp__search_repositories --args '{"query":"org:DF-wu"}' --output json
bash scripts/dfmcp call ticktick__list_projects --output json
bash scripts/dfmcp call hackmd__list-notes --output json
bash scripts/dfmcp call tavily-hikari__tavily_search --args '{"query":"MetaMCP"}' --output json
```

Tool argument names match each tool's JSON schema (GitHub often uses camelCase in schema; HackMD uses kebab-case tool suffixes).

## Wrapper mapping

| `dfmcp` subcommand | Behavior |
| --- | --- |
| `list` | `mcporter list --http-url $ENDPOINT --name $NAME` |
| `schema` | `list --schema` |
| `call <name>` | `mcporter call $ENDPOINT.<name>` unless name contains `.` or `http` |
| `auth`, `config`, `daemon`, … | passthrough to `mcporter` |
| `refresh` | runs `scripts/sync_catalog.py` |

## Optional persistent mcporter config

Not required for this skill. For interactive shells only:

```bash
mcporter config add --scope home dfmcp https://metamcp.dfder.tw/metamcp/chatbot/mcp
mcporter call dfmcp.github_mcp__get_me --output json
```

## Which manual guide to open

- GitHub → `references/GITHUB.md`
- TickTick → `references/TICKTICK.md`
- HackMD → `references/HACKMD.md`
- Context7 / DeepWiki / Tavily → `references/DOCS_AND_RESEARCH.md`
- Sequential thinking → `references/SEQUENTIAL_THINKING.md`

Exact tool names and required fields → matching `references/*.generated.md` (index: `references/catalog.generated.md`).

## Agent discipline

- `--output json` and `--args` for non-trivial payloads.
- One family guide + at most one generated file per task.
- Read/search before mutate when IDs are uncertain.
- After MetaMCP server changes, run `refresh` and commit generated docs (TreasureBox maintainers).
