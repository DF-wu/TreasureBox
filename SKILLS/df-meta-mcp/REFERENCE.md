---

# REFERENCE

This file is the operational quick-start for DF's MetaMCP endpoint skill.

Assume the current working directory is the **skill root**. If it is not, replace `scripts/dfmcp` and `scripts/sync_catalog.py` with the actual installed path of this skill.

## Endpoint

- Default URL: `https://metamcp.dfder.tw/metamcp/chatbot/mcp`
- Default mcporter name: `dfmcp`
- Wrapper: `scripts/dfmcp`

The wrapper prefers:

```bash
mcporter
```

Then falls back to:

```bash
bunx -y mcporter
```

And finally:

```bash
npx -y mcporter
```

You can temporarily override the endpoint or the logical server name via environment variables:

```bash
DF_METAMCP_ENDPOINT='https://example.com/mcp' DF_METAMCP_NAME=test bash scripts/dfmcp list
```

## The commands you will use most

List tools:

```bash
bash scripts/dfmcp list
bash scripts/dfmcp schema
bash scripts/dfmcp list --json
```

Call a tool:

```bash
bash scripts/dfmcp call github_mcp__get_me --output json
bash scripts/dfmcp call github_mcp__search_repositories --args '{"query":"DF-wu lilac-mono"}' --output json
bash scripts/dfmcp call hackmd__list-notes --output json
```

Refresh the generated catalogs:

```bash
bash scripts/dfmcp refresh
```

## Wrapper behavior

- `list` → `mcporter list --http-url <endpoint> --name <name>`
- `schema` → shorthand for `list --schema`
- `call <tool>` → accepts a plain tool name like `github_mcp__get_me`
- `call <selector>` → also accepts a fully qualified selector if you already have one
- `auth`, `config`, `generate-cli`, `inspect-cli`, `emit-ts`, `daemon` → passed through to `mcporter`

This keeps day-to-day usage short while still exposing the full mcporter surface when needed.

## Always prefer these calling conventions

### For objects / arrays / nested payloads

```bash
bash scripts/dfmcp call <tool> --args '{"key":"value","items":[1,2,3]}' --output json
```

### For simple scalar parameters

You may pass inline key/value arguments if the tool is simple, but `--args` is still safer and more consistent.

## Optional: add a named mcporter server outside the wrapper

If you want shorter raw `mcporter` commands outside the wrapper:

```bash
mcporter config add --scope home dfmcp https://metamcp.dfder.tw/metamcp/chatbot/mcp
```

Or, if `mcporter` is not installed globally:

```bash
bunx -y mcporter config add --scope home dfmcp https://metamcp.dfder.tw/metamcp/chatbot/mcp
```

Then:

```bash
mcporter list dfmcp --schema
mcporter call dfmcp.github_mcp__get_me --output json
```

This is optional. The skill does **not** require that config entry because the wrapper already hardcodes the endpoint by default.

## Refresh the generated catalogs directly

```bash
python3 scripts/sync_catalog.py
```

This updates:

- `references/catalog.generated.md`
- one generated markdown file per family

## Which reference file to read

- GitHub → `references/GITHUB.md`
- TickTick → `references/TICKTICK.md`
- HackMD → `references/HACKMD.md`
- Context7 / DeepWiki / Tavily → `references/DOCS_AND_RESEARCH.md`
- Sequential thinking helper → `references/SEQUENTIAL_THINKING.md`

## Practical defaults

- Prefer `--output json`
- Prefer `--args '{...}'`
- Do not dump the full catalog into context unless you actually need it
- Read/search the target object before mutation whenever IDs or exact targets are not already known
- Read only the relevant family file first
- Use the generated family files when you need exact tool names or required parameters
