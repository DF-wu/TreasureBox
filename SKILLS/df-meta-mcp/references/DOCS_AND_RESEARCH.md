# Docs & research (Context7, DeepWiki, Tavily)

## Context7 (`context7` — 2 tools)

1. `context7__resolve-library-id` — `libraryName` + `query` (max **3** calls per user question).
2. `context7__query-docs` — `libraryId` + `query` (max **3** calls per question).

Skip resolve if user already gave `/org/project` or `/org/project/version`.

## DeepWiki (`deepwiki` — 3 tools)

| Task | Tool |
| --- | --- |
| Topic outline | `deepwiki__read_wiki_structure` |
| Wiki page content | `deepwiki__read_wiki_contents` |
| Repo Q&A synthesis | `deepwiki__ask_question` |

Use for **one GitHub repo** knowledge — not third-party package docs (use Context7).

## Tavily (`tavily-hikari` — 5 tools)

| Task | Tool |
| --- | --- |
| Web search | `tavily-hikari__tavily_search` |
| URL extract | `tavily-hikari__tavily_extract` |
| Site crawl | `tavily-hikari__tavily_crawl` |
| Site map | `tavily-hikari__tavily_map` |
| Multi-source research | `tavily-hikari__tavily_research` |

Params: `context7.generated.md`, `deepwiki.generated.md`, `tavily-hikari.generated.md`.
