# Context7 live inventory

- Family key: `context7`
- Tool count: **2**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `context7__query-docs`

- **What it does:** Retrieves and queries up-to-date documentation and code examples from Context7 for any programming library or framework.
- **Required params:** `libraryId`, `query`
- **Important notes:**
  - You must call 'Resolve Context7 Library ID' tool first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.
  - IMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best information you have.

## `context7__resolve-library-id`

- **What it does:** Resolves a package/product name to a Context7-compatible library ID and returns matching libraries.
- **Required params:** `query`, `libraryName`
- **Important notes:**
  - You MUST call this function before 'Query Documentation' tool to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.
  - IMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best result you have.
