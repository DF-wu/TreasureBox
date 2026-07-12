# HackMD (`hackmd` — 14 tools)

Full params: `hackmd.generated.md`. Tool suffixes use **kebab-case** after `hackmd__`.

| Task | Tool |
| --- | --- |
| Profile + teams | `hackmd__get-me`, `hackmd__list-teams`, `hackmd__get-team` |
| List notes | `hackmd__list-notes`, `hackmd__list-team-notes` |
| Read note | `hackmd__get-note` |
| Recent history (metadata) | `hackmd__get-history` |
| Search by title | `hackmd__search-notes` |
| Create | `hackmd__create-note`, `hackmd__create-team-note` |
| Update | `hackmd__update-note`, `hackmd__update-team-note` |
| Delete (trash) | `hackmd__delete-note`, `hackmd__delete-team-note` |

Team paths: resolve `teamPath` from `hackmd__list-teams` / `hackmd__get-me` before team-note writes.
