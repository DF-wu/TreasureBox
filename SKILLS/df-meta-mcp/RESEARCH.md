---

# RESEARCH

This file captures the strongest external and internal patterns used to design `df-meta-mcp`.

## 1. Anthropic / Claude Code official guidance

### Source

- **Extend Claude Code** — https://code.claude.com/docs/en/features-overview
- **Skill authoring best practices** — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

### Key takeaways applied here

- **Skills are for on-demand knowledge and workflows**, not always-on prompt inflation.
- **Descriptions matter** because they are what the system sees up front to decide when a skill is relevant.
- **SKILL.md should act like a routing/index page**, with deeper reference files loaded only when needed.
- **Reference files should be split by topic** instead of stuffing everything into one monolith.

How this skill applies that guidance:

- Frontmatter description is dense with user-intent keywords: GitHub, PRs, issues, code search, reviews, Copilot, TickTick, Context7, DeepWiki.
- `SKILL.md` is a compact router.
- Detailed inventories live in generated family files under `references/`.

## 2. Dynamic loading / anti-bloat MCP patterns

### Sources

- **RAG-MCP: Mitigating Prompt Bloat in LLM Tool Selection via Retrieval-Augmented Generation** — https://arxiv.org/html/2505.03275v1
- **Reducing Context Bloat with Dynamic Context Loading (DCL) for MCP** — https://cefboud.com/posts/dynamic-context-loading-llm-mcp/
- **Handling ballooning context in the MCP era** — https://www.coderabbit.ai/blog/handling-ballooning-context-in-the-mcp-era-context-engineering-on-steroids

### Key takeaways applied here

- Naively loading large MCP tool surfaces hurts tool selection and wastes tokens.
- The winning pattern is **retrieve only the relevant tool documentation when needed**.
- Tool knowledge should be **curated, compressed, and routed intentionally**.

How this skill applies that guidance:

- Only the skill name + description are always visible.
- The full endpoint catalog is moved into generated reference files.
- The operator is told to read only the needed family file, not the whole catalog.

## 3. MCP Skills Bridge with MCPorter pattern

### Source

- **MCP Skills Bridge with MCPorter** — https://lobehub.com/mcp/arghhhhh-mcp-skills-bridge/skill.md

### Key takeaways applied here

- Use **skills as the documentation / routing layer**.
- Use **MCPorter as the execution bridge**.
- Keep MCP tool documentation out of the always-loaded prompt path.

How this skill applies that guidance:

- Execution goes through `mcporter`.
- Discovery and usage guidance live in skill docs.
- The wrapper script keeps execution simple while preserving the low-context skill pattern.

## 4. MCPorter capabilities that matter here

### Source

- `mcporter` README / docs shipped in the runtime

Key references used:

- `README.md` — `generate-cli`, `emit-ts`, ad-hoc HTTP calls
- `docs/cli-reference.md`
- `docs/emit-ts.md`

### Key takeaways applied here

- `mcporter list --http-url <endpoint> --json` is good enough to build a live catalog.
- `mcporter call <url.tool> --args '{...}' --output json` is the cleanest generic execution surface.
- `generate-cli --include-tools ...` exists as a future path if some families deserve their own tiny dedicated CLI.

How this skill applies that guidance:

- A wrapper script standardizes `list` and `call`.
- A sync script regenerates tool docs from the live endpoint.
- The design stays simple today, but preserves a path to family-specific CLIs later.

## 5. Lilac-specific fit

### Internal sources

- `PROJECT.md`
- `packages/utils/skills.ts`

### Key takeaways applied here

- Lilac already uses **progressive disclosure** for skills.
- The runtime appends a compact **Available Skills** index using only name + description.
- Descriptions are truncated for the prompt index, so the frontmatter description must carry the important keywords early.

How this skill applies that guidance:

- The description is intentionally short, dense, and intent-oriented.
- The deep catalog stays outside the default prompt path.

## Final design decision

Instead of exposing the MetaMCP endpoint as a large native tool surface, this skill uses:

1. **A strong, keyword-rich skill description** for discovery
2. **A small router-style SKILL.md**
3. **On-demand family docs** for GitHub / TickTick / docs / DeepWiki / sequential thinking
4. **MCPorter** as the execution bridge
5. **A generated live catalog** to keep tool docs current

This gives good discoverability without paying continuous context tax.