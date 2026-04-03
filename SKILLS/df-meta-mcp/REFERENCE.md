---

# REFERENCE

This file is the operational quick-start for DF's MetaMCP endpoint skill.

Assume the current working directory is the **skill root**. If it is not, replace `scripts/dfmcp` and `scripts/sync_catalog.py` with the actual installed path of this skill.

## Endpoint

- URL: `https://metamcp.dfder.tw/metamcp/chatbot/mcp`
- Wrapper: `scripts/dfmcp`

The wrapper prefers a locally installed `mcporter` binary, and falls back to:

```bash
npx -y mcporter ...
```

So it remains usable even on machines where `mcporter` is not installed globally.

## The two commands you will use most

List tools:

```bash
bash scripts/dfmcp list
bash scripts/dfmcp list --schema
bash scripts/dfmcp list --json
```

Call a tool:

```bash
bash scripts/dfmcp call github_mcp__get_me --output json
bash scripts/dfmcp call github_mcp__search_repositories --args '{"query":"DF-wu lilac-mono"}' --output json
```

## Always prefer these calling conventions

### For objects / arrays / nested payloads

```bash
bash scripts/dfmcp call <tool> --args '{"key":"value","items":[1,2,3]}' --output json
```

### For simple scalar parameters

You may pass inline key/value arguments if the tool is simple, but `--args` is still safer and more consistent.

## Optional: add a named mcporter server

If you want shorter raw `mcporter` commands outside the wrapper:

```bash
bun "$(command -v mcporter)" config add --scope home dfmcp https://metamcp.dfder.tw/metamcp/chatbot/mcp
```

Then:

```bash
bun "$(command -v mcporter)" list dfmcp --schema
bun "$(command -v mcporter)" call dfmcp.github_mcp__get_me --output json
```

This is optional. The skill does **not** require that config entry because the wrapper already hardcodes the endpoint.

## Refresh the generated catalogs

```bash
python3 scripts/sync_catalog.py
```

This updates:

- `references/catalog.raw.json`
- `references/catalog.generated.md`
- one generated markdown file per family

## Which reference file to read

- GitHub → `references/GITHUB.md`
- TickTick → `references/TICKTICK.md`
- Context7 / DeepWiki → `references/DOCS_AND_RESEARCH.md`
- Sequential thinking helper → `references/SEQUENTIAL_THINKING.md`

## Practical defaults

- Prefer `--output json`
- Prefer `--args '{...}'`
- Do not dump the full catalog into context unless you actually need it
- Read only the relevant family file first
- Use the generated family files when you need exact tool names or required parameters
