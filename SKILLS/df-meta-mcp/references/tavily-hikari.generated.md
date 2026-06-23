# Tavily live inventory

- Family key: `tavily-hikari`
- Tool count: **5**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `tavily-hikari__tavily_crawl`

- **What it does:** Crawl a site with Tavily
- **Required params:** `url`
- **Optional params (first 8):** `allow_external`, `extract_depth`, `format`, `include_favicon`, `instructions`, `limit`, `max_breadth`, `max_depth`

## `tavily-hikari__tavily_extract`

- **What it does:** Extract page content with Tavily
- **Required params:** `urls`
- **Optional params (first 5):** `extract_depth`, `format`, `include_favicon`, `include_images`, `query`

## `tavily-hikari__tavily_map`

- **What it does:** Map a site with Tavily
- **Required params:** `url`
- **Optional params (first 7):** `allow_external`, `instructions`, `limit`, `max_breadth`, `max_depth`, `select_domains`, `select_paths`

## `tavily-hikari__tavily_research`

- **What it does:** Run Tavily research
- **Required params:** `input`
- **Optional params (first 1):** `model`

## `tavily-hikari__tavily_search`

- **What it does:** Search the web with Tavily
- **Required params:** `query`
- **Optional params (first 8):** `country`, `end_date`, `exact_match`, `exclude_domains`, `include_domains`, `include_favicon`, `include_image_descriptions`, `include_images`
