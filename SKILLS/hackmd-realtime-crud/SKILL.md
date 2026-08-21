---
name: hackmd-realtime-crud
description: Manage HackMD notes through authenticated realtime OT without API credit or browser editor automation.
---

# HackMD Realtime CRUD

Use the installed `hackmd-rt` binary. Run `hackmd-rt --help` before choosing
flags. This tool uses HackMD's private realtime protocol and a browser-cookie
session; it never calls `api.hackmd.io/v1`.

Check authentication with `hackmd-rt status --json`. When authentication is
missing, ask the user to export HackMD cookies to a local JSON file, then run:

```bash
hackmd-rt auth import --cookie-file /absolute/export.json --clear --json
```

Never inspect, print, attach, or commit the cookie export or cookie store.

Prefer IDs or URLs as selectors. Exact titles are accepted, but duplicate
titles fail. `notes search` covers overview title, tags, and excerpt only.

Read exact Markdown:

```bash
hackmd-rt notes get NOTE_ID_OR_URL --raw
```

For create or update, stage the complete UTF-8 Markdown in a temporary file or
pipe it through stdin:

```bash
hackmd-rt notes create --file /tmp/note.md --title "Title" --json
hackmd-rt notes update NOTE_ID_OR_URL --file /tmp/note.md --json
```

Mutations are successful only after realtime acknowledgement and an independent
reconnection reproduces the exact Markdown. Exit code 4 means a concurrent edit
was preserved and the requested exact final content was not reached; reconcile
the latest note instead of retrying blindly.

Exit code 5 means the server may have accepted a create, update, or delete but
the final state could not be established. Read the identified note or check
HackMD Trash before retrying; never replay an uncertain mutation blindly.

Delete only when the current user request explicitly identifies the note and
authorizes deletion. Then pass `--yes`:

```bash
hackmd-rt notes delete NOTE_ID_OR_URL --yes --json
```

If the handshake schema changes, stop. Do not fall back to guessed events or
raw undocumented endpoints for mutation.
