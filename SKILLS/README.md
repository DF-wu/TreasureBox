# SKILLS

`SKILLS/` is the canonical home for active Agent Skills in this repository.

## Layout policy

- Active skills must live at `SKILLS/<skill-name>/SKILL.md`.
- Do not create parallel top-level `SKILL/`, `skills/`, or scattered skill directories.
- Deprecated skill names should not remain as active duplicates.
- If a retired skill should remain recoverable, move it to `SKILLS/_ARCHIVE/<skill-name>/` and keep its original `SKILL.md` plus a short archive note.
- If a skill is obsolete and not worth preserving, remove it instead of leaving duplicate copies under another directory name.

## Current active skills

As of 2026-06-12, the active skill directories are:

- `SKILLS/df-meta-mcp/`
- `SKILLS/new-api-manage/`
- `SKILLS/qwen3-asr-tts-hf2api/`
- `SKILLS/vits-tts-hf2api/`
- `SKILLS/web-reverse-engineering/`

## 2026-06-12 normalization check

A repository scan confirmed there are no active `SKILL.md` files outside `SKILLS/`.

The deprecated `qwen3-hf2api` and `vits-hf2api` skill directory names were removed in favor of the canonical names `qwen3-asr-tts-hf2api` and `vits-tts-hf2api`.
