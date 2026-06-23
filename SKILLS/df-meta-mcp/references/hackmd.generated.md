# HackMD live inventory

- Family key: `hackmd`
- Tool count: **14**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `hackmd__create-note`

- **What it does:** Create a new markdown note
- **Required params:** `content`
- **Optional params (first 1):** `title`

## `hackmd__create-team-note`

- **What it does:** Create a new note in a specific team
- **Required params:** `teamPath`, `content`
- **Optional params (first 1):** `title`

## `hackmd__delete-note`

- **What it does:** Delete a note (moves to trash)
- **Required params:** `noteId`

## `hackmd__delete-team-note`

- **What it does:** Delete a note from a team (moves to trash)
- **Required params:** `teamPath`, `noteId`

## `hackmd__get-history`

- **What it does:** Get the user's note history (recently accessed notes). Returns note metadata (not content). Use get-note to retrieve full content.
- **Required params:** (none)
- **Optional params (first 1):** `limit`

## `hackmd__get-me`

- **What it does:** Get the current authenticated user's profile information including teams and upgrade status
- **Required params:** (none)

## `hackmd__get-note`

- **What it does:** Retrieve the content of a specific note by ID
- **Required params:** `noteId`

## `hackmd__get-team`

- **What it does:** Get information about a specific team
- **Required params:** `teamPath`

## `hackmd__list-notes`

- **What it does:** List all notes accessible to the authenticated user. Returns note metadata (not content). Use get-note to retrieve full content.
- **Required params:** (none)
- **Optional params (first 2):** `page`, `limit`

## `hackmd__list-team-notes`

- **What it does:** List all notes in a specific team. Returns note metadata (not content). Use get-note to retrieve full content.
- **Required params:** `teamPath`
- **Optional params (first 2):** `page`, `limit`

## `hackmd__list-teams`

- **What it does:** List all teams the authenticated user belongs to
- **Required params:** (none)

## `hackmd__search-notes`

- **What it does:** Search for notes by title. Searches within your personal notes and team notes you have access to.
- **Required params:** `query`
- **Optional params (first 1):** `limit`

## `hackmd__update-note`

- **What it does:** Update the content of an existing note
- **Required params:** `noteId`, `content`

## `hackmd__update-team-note`

- **What it does:** Update the content of an existing note in a team
- **Required params:** `teamPath`, `noteId`, `content`
