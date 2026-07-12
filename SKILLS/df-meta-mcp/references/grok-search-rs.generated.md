# Grok Search Rs live inventory

- Family key: `grok-search-rs`
- Tool count: **5**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `grok-search-rs__doctor`

- **What it does:** Diagnostic probe: live connectivity check for Grok, Tavily, and Firecrawl backends, plus masked configuration. Use to verify the server is wired up and reachable.
- **Required params:** (none)

## `grok-search-rs__get_sources`

- **What it does:** Return cached sources from a previous web_search call by session_id. Use to re-examine sources already retrieved without issuing a new search — it reuses the prior session and runs no new search or fetch. Paginate with offset/limit: the response reports total_sources and, when more pages remain, next_offset to pass as the next offset.
- **Required params:** `session_id`
- **Optional params (first 2):** `limit`, `offset`

## `grok-search-rs__web_fetch`

- **What it does:** Use when you already have a specific URL and want to read a single page in depth. GitHub issue/PR, StackOverflow (StackExchange), arXiv, and Wikipedia URLs are automatically parsed into structured, de-noised Markdown ready to feed an LLM; all other pages fall back to generic extraction. Returns {url, content, original_length, truncated, source_type, fallback_reason?}. If you don't have a URL yet and need to discover sources, use web_search instead.
- **Required params:** `url`
- **Optional params (first 1):** `max_chars`

## `grok-search-rs__web_map`

- **What it does:** Map/discover URLs through Tavily Map.
- **Required params:** `url`
- **Optional params (first 1):** `max_results`

## `grok-search-rs__web_search`

- **What it does:** Use for discovery — when you don't have a specific URL and need to find information, debug an error, research a topic, or track down an issue or news item. Returns an AI-synthesised answer plus a source list. By default the first few sources carry inline content (max_inline_sources, default 5); the rest are metadata-only — drill into any of them with web_fetch(url). The whole response is capped by a character budget; when truncated=true, trimmed sources carry a note telling you how to recover the full text via web_fetch or get_sources. Pass response_format="concise" for answer + source metadata only. If you already know the exact page URL, use web_fetch instead.
- **Required params:** `query`
- **Optional params (first 8):** `exclude_domains`, `extra_sources`, `include_content`, `include_domains`, `model`, `platform`, `recency_days`, `response_format`
