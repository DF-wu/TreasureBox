# Tavily live inventory

- Family key: `tavily-hikari`
- Tool count: **5**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `tavily-hikari__tavily_crawl`

- **What it does:** Crawl a site with Tavily
- **Required params:** `url`
- **Optional params (first 8):** `allow_external`, `chunks_per_source`, `exclude_domains`, `exclude_paths`, `extract_depth`, `format`, `include_favicon`, `include_images`

## `tavily-hikari__tavily_extract`

- **What it does:** Extract page content with Tavily
- **Required params:** `urls`
- **Optional params (first 7):** `chunks_per_source`, `extract_depth`, `format`, `include_favicon`, `include_images`, `query`, `timeout`

## `tavily-hikari__tavily_map`

- **What it does:** Map a site with Tavily
- **Required params:** `url`
- **Optional params (first 8):** `allow_external`, `exclude_domains`, `exclude_paths`, `instructions`, `limit`, `max_breadth`, `max_depth`, `select_domains`

## `tavily-hikari__tavily_research`

- **What it does:** Run Tavily research
- **Required params:** `input`
- **Optional params (first 7):** `citation_format`, `exclude_domains`, `files`, `include_domains`, `model`, `output_length`, `output_schema`

## `tavily-hikari__tavily_search`

- **What it does:** Search the web with Tavily
- **Required params:** `query`
- **Optional params (first 8):** `auto_parameters`, `chunks_per_source`, `country`, `end_date`, `exact_match`, `exclude_domains`, `include_answer`, `include_domains`
