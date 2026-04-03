# Tavily live inventory

- Family key: `tavily-hikari`
- Tool count: **6**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `tavily-hikari__tavily_crawl`

- **What it does:** Crawl a website starting from a URL. Extracts content from pages with configurable depth and breadth.
- **Required params:** `url`
- **Optional params (first 8):** `max_depth`, `max_breadth`, `limit`, `instructions`, `select_paths`, `select_domains`, `allow_external`, `extract_depth`

## `tavily-hikari__tavily_extract`

- **What it does:** Extract content from URLs. Returns raw page content in markdown or text format.
- **Required params:** `urls`
- **Optional params (first 5):** `extract_depth`, `include_images`, `format`, `include_favicon`, `query`

## `tavily-hikari__tavily_map`

- **What it does:** Map a website's structure. Returns a list of URLs found starting from the base URL.
- **Required params:** `url`
- **Optional params (first 7):** `max_depth`, `max_breadth`, `limit`, `instructions`, `select_paths`, `select_domains`, `allow_external`

## `tavily-hikari__tavily_research`

- **What it does:** Perform comprehensive research on a given topic or question. Use this tool when you need to gather information from multiple sources, including web pages, documents, and other resources, to answer a question or complete a task. Returns a detailed response based on the research findings. Rate limit: 20 requests per minute.
- **Required params:** `input`
- **Optional params (first 1):** `model`

## `tavily-hikari__tavily_search`

- **What it does:** Search the web for current information on any topic. Use for news, facts, or data beyond your knowledge cutoff. Returns snippets and source URLs.
- **Required params:** `query`
- **Optional params (first 8):** `max_results`, `search_depth`, `topic`, `time_range`, `include_images`, `include_image_descriptions`, `include_raw_content`, `include_domains`

## `tavily-hikari__tavily_skill`

- **What it does:** Search documentation for any library, API, or tool. Returns relevant, structured documentation chunks assembled for your specific query. When working with a specific library, always pass the library name for best results.
- **Required params:** `query`
- **Optional params (first 5):** `library`, `language`, `task`, `context`, `max_tokens`
