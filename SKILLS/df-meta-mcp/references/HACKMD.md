---

# HACKMD

Use this family for **HackMD note creation, updates, note lookup, history, and team note workflows**.

## Fast selection rules

- **Need your profile / teams first?** Use `get-me` or `list-teams`.
- **Need all accessible notes?** Use `list-notes`.
- **Need notes in a specific team?** Use `list-team-notes`.
- **Need one note's content?** Use `get-note`.
- **Need recent notes?** Use `get-history`.
- **Need title-based lookup?** Use `search-notes`.
- **Need to create personal notes?** Use `create-note`.
- **Need to create team notes?** Use `create-team-note`.
- **Need to update note content?** Use `update-note` or `update-team-note`.
- **Need to remove a note?** Use `delete-note` or `delete-team-note`.

## Important gotchas

- Team note operations require `teamPath`; do not guess it—read it from `list-teams` or `get-me` first.
- `list-notes` and `list-team-notes` return metadata; use `get-note` to fetch full content.
- If there are multiple similarly named notes, search/list first and only mutate after resolving the exact `noteId`.

## Use the generated inventory when you need exact tool names / parameters

Open `references/hackmd.generated.md`.
