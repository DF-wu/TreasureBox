# DeepWiki live inventory

- Family key: `deepwiki`
- Tool count: **3**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `deepwiki__ask_question`

- **What it does:** Ask any question about a GitHub repository and get an AI-powered, context-grounded response.
- **Required params:** `repoName`, `question`
- **Important notes:**
  - repoName: GitHub repository or list of repositories (max 10) in owner/repo format

## `deepwiki__read_wiki_contents`

- **What it does:** View documentation about a GitHub repository.
- **Required params:** `repoName`

## `deepwiki__read_wiki_structure`

- **What it does:** Get a list of documentation topics for a GitHub repository.
- **Required params:** `repoName`
