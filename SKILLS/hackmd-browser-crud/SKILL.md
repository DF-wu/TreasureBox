---
name: hackmd-browser-crud
description: Manage a user's HackMD notes with the local hackmd-web CLI, a persistent browser-cookie session, and HackMD's visible website while avoiding the metered Public API and official MCP. Use for authenticating, listing, searching, reading, creating, updating, or deleting personal HackMD notes when the user asks to manage HackMD, supplies a hackmd.io note URL or cookie export, or wants to avoid API-token quota. May pause for manual sign-in, CAPTCHA, SSO, or 2FA.
---

# HackMD Browser CRUD

Use the bundled `hackmd-web` CLI as the primary interface. It stores HackMD's browser session in a user-private persistent Chrome/Edge profile, accepts refreshed cookies automatically, and never calls `api.hackmd.io/v1` or the official MCP.

## CLI runner

Resolve `<skill-dir>` to the directory containing this `SKILL.md`, then run every command through:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" --help
```

Do not assume a global `hackmd-web` installation. On first use, the runner installs the pinned `playwright-core` dependency from the bundled lockfile. Require Node.js 20+ and a locally installed Chrome or Edge.

## Authentication

Check the current session:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" status --json
```

If the session expired, open an interactive login window:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" login
```

Let the user complete passwords, CAPTCHA, SSO, passkeys, or 2FA. Never request or handle those secrets directly.

When the user supplies a browser cookie JSON export, import it without printing cookie names or values:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" auth import --cookie-file "ABSOLUTE_COOKIE_EXPORT_PATH" --clear --json
```

The default profile is `%LOCALAPPDATA%\hackmd-web-cli\profile`. Treat the whole directory as a live credential: never inspect, print, copy, commit, or place it in a repository. A server-revoked or fully expired session requires the bundled `login` command above; cookie refresh cannot bypass reauthentication.

## Resolve notes

Accept a note ID, short ID, exact title, permalink, or `hackmd.io` URL. Prefer IDs or URLs. The CLI rejects duplicate exact titles instead of guessing.

List and search metadata:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" notes list --limit 50 --json
node "<skill-dir>/scripts/hackmd-web.mjs" notes search "keyword" --limit 20 --json
```

Search covers titles, tags, and HackMD's overview excerpt. Do not claim it searched every byte of every note. Resolve important matches with an exact read.

## Read exact Markdown

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" notes get "NOTE_ID_OR_URL" --json
```

Exact reads open the visible editor and read its complete Markdown model. Preserve frontmatter, tags, embeds, code fences, and HackMD directives when returning or transforming content.

## Create

Default to the user's personal root only when no team or folder is named. The initial CLI supports personal-root creation; use the website fallback for an explicitly requested team or folder.

Stage the complete Markdown in a temporary UTF-8 file, then run:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" notes create --file "ABSOLUTE_TEMP_FILE.md" --json
```

Use `--title "TITLE"` only when the title must be prepended as an H1. Never place user Markdown directly in PowerShell command source; it can contain backticks, `$()`, quotes, or newlines.

The CLI waits for a saved revision, reloads the note, and compares the complete Markdown before reporting success.

## Update

1. Resolve and read the exact note.
2. Preserve unrequested frontmatter, title, tags, permissions, and HackMD syntax.
3. Stage the complete replacement Markdown in a temporary UTF-8 file.
4. Run:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" notes update "NOTE_ID_OR_URL" --file "ABSOLUTE_TEMP_FILE.md" --json
```

The CLI checks the note revision before editing, performs the change in the visible editor, waits for a new saved revision, reloads, and verifies exact Markdown. If it reports a concurrent edit, stop and reconcile instead of overwriting.

## Delete

Treat a current user request that explicitly names the exact note and asks to delete it as authorization. Otherwise ask for confirmation immediately before deletion. Resolve the note first, then pass `--yes` only after authorization:

```powershell
node "<skill-dir>/scripts/hackmd-web.mjs" notes delete "NOTE_ID_OR_URL" --yes --json
```

The CLI uses HackMD's delete dialog and verifies that the note disappeared from the active-note overview. Report that it was moved to HackMD Trash. Never empty Trash or permanently delete notes without a separate explicit request.

## Website fallback

Internal endpoints and UI structure are unstable. If `hackmd-web` reports that the website response or UI changed:

1. Use a named `agent-browser` session and open `https://hackmd.io/?nav=overview`.
2. Run a new `snapshot -i` after every navigation, modal, mode change, or meaningful DOM update.
3. Prefer accessibility refs and semantic roles over CSS selectors or coordinates.
4. Use only same-origin requests observed in the current website traffic and authenticated by its cookies.
5. Never call `api.hackmd.io/v1`, `mcp.hackmd.io`, or an endpoint recalled from memory.
6. Do not probe mutations on real notes; use visible controls or an explicitly disposable test note.
7. Verify mutations by reloading and comparing the requested result.

The observed overview request is `GET https://hackmd.io/api/overview?v=...`. Treat its `content` field as an excerpt, not exact Markdown. Use the editor for exact reads.

## Failure handling

- Reauthenticate manually when `status` fails.
- Stop for CAPTCHA, abuse prevention, permission walls, or ambiguous destructive controls.
- Keep the staged Markdown until create or update verification succeeds.
- Do not claim success when the save revision or reload comparison fails.
- Preserve the profile and local source file when a transient network error occurs; retry only after checking the note state.

## Completion report

For every mutation, report the action, title, workspace, canonical URL when it still exists, verification performed, access path (`website UI`), and Trash recovery information for deletion.
