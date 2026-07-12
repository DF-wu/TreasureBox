# REFERENCE

Operational quick-start for **DF MetaMCP**. Commands assume the **skill root** as cwd.

## Endpoint and wrapper

| Item | Value |
| --- | --- |
| URL | `DF_METAMCP_ENDPOINT` (default in `scripts/dfmcp`) |
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

### Call examples (names from live dfmcp)

```bash
bash scripts/dfmcp call github_mcp__get_me --output json
bash scripts/dfmcp call github_mcp__pull_request_read --args '{"owner":"DF-wu","repo":"TreasureBox","pullNumber":1}' --output json
bash scripts/dfmcp call ticktick__list_projects --output json
bash scripts/dfmcp call hackmd__list-notes --output json
bash scripts/dfmcp call context7__resolve-library-id --args '{"libraryName":"Bun","query":"test"}' --output json
bash scripts/dfmcp call tavily-hikari__tavily_search --args '{"query":"..."}' --output json
```

Task → tool: `references/GITHUB.md` (44), `TICKTICK.md` (47), `HACKMD.md` (14), `DOCS_AND_RESEARCH.md`, `SEQUENTIAL_THINKING.md`. Params: `*.generated.md`.

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
# Optional; same URL/name as scripts/dfmcp defaults or your DF_METAMCP_* env
mcporter config add --scope home "${DF_METAMCP_NAME:-dfmcp}" "${DF_METAMCP_ENDPOINT:?set endpoint}"
mcporter call "${DF_METAMCP_NAME:-dfmcp}.github_mcp__get_me" --output json
```

## Which guide

See `references/ROUTING.md`. Params: one matching `*.generated.md` or `bash scripts/dfmcp schema` (heavy).

## Agent discipline

- `--output json` and `--args` for non-trivial payloads.
- One family guide + at most one generated file per task.
- Read/search before mutate when IDs are uncertain.
- Catalog files are optional cache; refresh when missing or after gateway changes.
