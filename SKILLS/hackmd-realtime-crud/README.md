# hackmd-realtime-cli

`hackmd-rt` is an agent-friendly HackMD CLI that uses an authenticated browser
session and HackMD's realtime operational-transform channel. It does not call
the quota-limited public API and does not automate the editor DOM.

Version 2.0 was verified against HackMD production on 2026-08-21. The realtime
wire protocol is private and may change without notice, so every mutation waits
for an OT acknowledgement and then reconnects to verify the complete Markdown.

## Requirements

- Node.js 22 or newer
- A HackMD browser-cookie JSON export for authenticated/private notes

The cookie store is a live credential. Keep it outside repositories and never
print, copy, or attach it.

## Install

```bash
npm install
npm link
```

## Authentication

Export cookies for `hackmd.io` as JSON with a browser extension, then import
them into the private local store:

```bash
hackmd-rt auth import --cookie-file /absolute/cookies.json --clear --json
hackmd-rt status --json
```

The default store is `${XDG_CONFIG_HOME:-~/.config}/hackmd-rt/cookies.json`
with mode `0600`. `HACKMD_RT_COOKIES` or `--cookies` can override it.

## Note workflows

```bash
hackmd-rt notes list --json
hackmd-rt notes search keyword --json
hackmd-rt notes get NOTE_ID_OR_URL --raw
hackmd-rt notes create --file note.md --title "Title" --json
hackmd-rt notes update NOTE_ID_OR_URL --file note.md --json
hackmd-rt notes delete NOTE_ID_OR_URL --yes --json
```

Selectors accept an exact title, note ID, short ID, permalink, or HackMD URL.
Duplicate exact titles fail instead of selecting arbitrarily. Search uses the
overview metadata and excerpt, not the complete text of every note.

Create and update consume complete Markdown from a file or stdin. Update sends
a minimal single-span OT replacement from the current realtime snapshot,
waits for `ack`, reconnects, and compares the full Markdown. A concurrent edit
is preserved by HackMD OT; if it changes the requested final document, the CLI
returns exit code 4 instead of overwriting it again.

If a connection drops after a mutation may have reached HackMD, the CLI
reconnects before deciding the result. Exact readback is reported as verified
success; a mismatch or failed reconciliation returns exit code 5 and identifies
the note whose outcome must be checked before retrying. Create and delete use
the same explicit uncertain-outcome classification for partial failures.

## Protocol

The current editor advertises its registration endpoint in the
`realtime-register-serverurl` meta tag. The CLI resolves that endpoint, opens a
cookie-authenticated Socket.IO connection with `query.noteId`, and uses the
public [`hackmdio/ot.js`](https://github.com/hackmdio/ot.js) operation format:

- `doc { str, revision, clients }` initializes a snapshot.
- `operation(revision, ops, null)` submits a mutation.
- `ack(nextRevision)` confirms acceptance by the realtime server.

Operation offsets are JavaScript UTF-16 code units. The CLI uses HackMD's OT
implementation directly, including for emoji and supplementary characters.

An acknowledgement alone is not treated as durable success. Reconnection and
exact readback are mandatory. Handshake or payload drift fails closed.

## Development

```bash
npm run check
```

Production smoke tests require an explicit disposable note and are not run by
the unit test suite.
