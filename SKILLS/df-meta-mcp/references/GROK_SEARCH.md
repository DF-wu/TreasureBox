# Grok search (`grok-search-rs` — 5 tools)

Full params: `grok-search-rs.generated.md`.

| Task | Tool |
| --- | --- |
| Verify backends / config | `grok-search-rs__doctor` |
| Discover topic, errors, news (no URL yet) | `grok-search-rs__web_search` |
| Read one known URL (deep) | `grok-search-rs__web_fetch` |
| Map URLs on a site | `grok-search-rs__web_map` |
| Page sources from prior search | `grok-search-rs__get_sources` (`session_id` from `web_search`) |

## Pick search vs fetch

- **No URL yet** → `grok-search-rs__web_search` (`query`). Inline content for first sources; use `grok-search-rs__web_fetch` on a source URL for full text, or `grok-search-rs__get_sources` with `session_id` + `offset`/`limit`.
- **URL already known** → `grok-search-rs__web_fetch` (GitHub issue/PR, StackExchange, arXiv, Wikipedia get structured markdown).

## vs Tavily

Both do web research. Prefer **grok-search-rs** when you want Grok-synthesised answers + session/source pagination (`web_search` / `get_sources`). Prefer **tavily-hikari__*** when the task already names Tavily crawl/map/research or you need Tavily-specific options — see `DOCS_AND_RESEARCH.md`.
