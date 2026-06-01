# 2026-05-31 — VITS skill audit, fix, and verification pass

Single-session record of what changed, what was tested, and what remains open. Written so the next maintainer can pick up the same context without replaying the conversation.

---

## TL;DR

- Audited `SKILL.md` and the Go binary; found **6 first-use bugs**, **3 silent-failure UX traps**, and a long tail of doc inconsistencies.
- Verified the real upstream API by probing all 4 HuggingFace Spaces directly (curl + WS handshake).
- Fixed Go binary, Python package, SKILL.md, and `update_speakers.py`. Added `README.md` (maintainer doc) and `references/seiyuu_table.md`.
- Re-ran 11 Go + 3 bash + 3 Python end-to-end cases against live upstream. All produce real WAV audio (26-173 KB RIFF mono 22050 Hz). Python pytest 50/50.
- The skill should now succeed on a first-time agent's first call for any in-coverage character (Genshin / HI3 / Uma Musume).

---

## 1. Symptoms that triggered the audit

User reported: "agents still misuse the API and features on first use of this skill."

Diagnosing the failure modes revealed the following patterns:
- Agent triggers on Star Rail / Re:Zero / SAO requests because `SKILL.md` description claims those IPs.
- Agent copy-pastes a curl example containing `黄泉` — fails with "unknown speaker".
- Agent uses Python helper, gets different default speaker than bash/Go.
- Agent uses default `-l mix` with plain Japanese — gets a 556-byte WAV containing silence and reports "success".
- Agent passes a JP-only voice with Chinese text — gets HTTP 500 across all 4 upstreams with no actionable hint.

All of these are now either prevented, warned about, or detected post-hoc.

## 2. Upstream API behavior — verified by direct probes

The single most important finding: **upstream behavior was partially mis-documented in the old SKILL.md.** The verified truth is now in `README.md` §2; the highlights are:

| Space | Transport | `session_hash` | Verified status code on bad input |
|-------|-----------|----------------|------------------------------------|
| ikechan8370 | REST `/api/generate/` | optional | 500 for JP voice + ZH text, 200 otherwise |
| AHJoong | REST | **required** (422 without) | same |
| OldSecond | REST | **required** | sometimes empty body when cold |
| zomehwh | **WS only** — REST returns `{"detail":"Not authorized to skip the queue"}` | in queue proto | 100-char text limit |

Tested with:

```bash
curl -i -X POST "https://ikechan8370-vits-uma-genshin-honkai.hf.space/api/generate/" \
  -H "Content-Type: application/json" \
  -d '{"fn_index":0,"data":["你好","日语","日语甘雨（上田丽奈）",0.6,0.668,1.2]}'
# → HTTP/2 500   body: {"error":null}
```

Other confirmed facts:
- Successful response shape: `{"data":["生成成功!", {"name":"/tmp/.../tmp*.wav","data":null,"is_file":true}, "生成耗时 N s"], ...}`
- Download via `GET /file=<that name>` returns RIFF mono 22050 Hz 16-bit PCM.
- mix-without-markers produces a 556-byte WAV (RIFF header valid, ~zero PCM samples). Reproducible.
- The 804-speaker dropdown is component `id=13` in `/config`. Stable.
- Languages dropdown is component `id=7`, 3 choices. Values are Simplified Chinese (`日语`, not `日本語`).
- Same speaker list across all 4 sibling Spaces — they share the model.
- `zomehwh-vits-models-genshin-bh3.hf.space` is a *different* Space with per-character models keyed by `fn_index` (0/5/10/15/20/25/30) + integer `sid`. Only the Python package targets it.

## 3. Changes by file

### `SKILL.md` — full rewrite

- Description trimmed to honest coverage: Genshin (≤3.5), HI3, Uma Musume. Removed false claims of Star Rail / Re:Zero / SAO / Fate / Vocaloid / Demon Slayer / AOT.
- Three Paths sections (A: Go binary, B: bash, C: Python) — each verified working against live upstream in this session.
- Removed the `黄泉` example. Replaced with characters confirmed present.
- Defaults unified: speaker = `日语神里绫华（早见沙织）`, language = `ja` (not `mix`) across all three paths.
- Added the §5 gotchas block, with the empty-WAV failure mode named explicitly.
- Removed the aspirational "Per-Character Models" section that promised bash/Go support that didn't exist; replaced with a one-paragraph pointer to the Python package which does support it.
- Added Coverage truth table (what's in, what's not) up front so agents reject out-of-coverage requests early.
- Catalog tables shortened to representative subsets — full 804 list lives in `references/vits_speakers.json` and `--list-speakers`.
- Seiyuu reverse lookup moved to `references/seiyuu_table.md`.

### Go binary

`src/go/cmd/vits-tts/main.go`
- Added `--version` flag, bumped to `0.3.0`.
- New `client.AttemptLog` print loop on failure — every attempted upstream + its error is logged so the user sees what was tried.
- mix-without-markers pre-flight warning.
- JP-voice + ZH-text post-mortem hint when all upstreams fail.
- Truncation warning when text exceeds 500 runes (now prints both pre/post lengths).
- Resolved-speaker line shows the resolution kind (alias / prefix / substring) when not exact.
- WS fallback gated on `wss://` URL scheme when `--url` is set (prevents misrouting REST URLs through `/queue/join`).
- Empty-WAV post-flight detection via `client.IsLikelyEmptyWAV`.

`src/go/internal/speaker/data.go`
- **`//go:embed vits_speakers.json`** — binary is now fully self-contained. No more runtime file dependency, no more `panic("speaker: cannot find ...")` if the binary is moved.
- Default language flipped from `mix` to `ja`.
- Added `LanguageKeysSorted` for stable `--list-languages` output.

`src/go/internal/speaker/speaker.go`
- New `ResolveSpeakerDetailed` returns `(Resolved, Kind)` so callers can warn about fuzzy matches.
- **Resolution priority changed**: exact upstream choice → case-insensitive exact → alias → prefix → substring. Previously alias won, which hijacked `-s 派蒙` to the JP voice. Now `-s 派蒙` gets the CN voice and `-s paimon` gets the JP voice — what the user types is what they get.

`src/go/internal/client/rest.go`
- Removed the unreachable `case map[string]any:` branch.
- `data[1]` parsed via clean switch handling both dict and string shapes.
- Empty body now treated as retriable (503) — OldSecond cold-start case.
- HTTP 500/429 → `HTTPStatusError{Retryable:true}`.
- HTTP 4xx → includes the response snippet in the error so the user sees why.
- `isTimeout` rewritten with `errors.Is(context.DeadlineExceeded)` + `net.Error.Timeout()` — no more string matching.
- Result WAV validated as RIFF/WAVE before returning.

`src/go/internal/client/ws.go`
- 8 MB read limit (was 1 MB) — Gradio estimation messages can include the full 804-speaker list.
- Switch-based message dispatch instead of `if` chain.
- Handles `data:audio/wav;base64,...` URI, dict-with-`data`-base64, dict-with-`name`, dict-with-`path`. Three known fork shapes.
- WAV validation on returned bytes.
- `RandomSessionHash` exported and reused by `retry.go`.

`src/go/internal/client/retry.go`
- One source of `RandomSessionHash` (was duplicated).
- `AttemptLog` struct surfaces the per-URL attempt to the CLI.
- 4xx → non-retriable EXCEPT for HTTP 422 from the primary, which falls through to backups (AHJoong expects `session_hash`, ikechan8370 ignores it — but if ikechan8370 ever changes behavior and 422's, the next backup might still succeed).

`src/go/internal/config/config.go`
- Removed unused `ModuleName` constant.
- Documented retry-chain order in the package doc.
- `NewConfig().Language = "ja"` (was `"mix"`).

### Python package

`src/python/vits_tts_hf2api/retry.py`
- `call_gradio_rest_with_retry` now defaults `fn_index=0` (was `None`). Matches bash/Go examples. ikechan8370 tolerates None; the backups may not.

`src/python/vits_tts_hf2api/config.py`
- `DEFAULT_LANGUAGE = "ja"` (was `"mix"`).

`src/python/vits_tts_hf2api/tts.py`
- `_is_likely_empty_wav` detects 556-byte degenerate output. `/v1/audio/speech` now returns `X-Warning: empty-wav` header in that case so OpenAI-shaped clients can recognize the failure.

`tests/test_config.py`
- Updated defaults to match (`日语神里绫华（早见沙织）`, `ja`).
- 50/50 passing.

### Tooling

`update_speakers.py`
- Now writes the JSON to **both** `references/vits_speakers.json` AND `src/go/internal/speaker/vits_speakers.json` so the Go `//go:embed` copy never drifts from the canonical reference.

### New files

- `README.md` — full maintainer guide. Layout, verified upstream behavior, all 5 gotchas, coverage truth table, resolution algorithm pseudocode, where to change defaults, the regression script, the 9 anti-patterns we just removed.
- `references/seiyuu_table.md` — Genshin JP cast → Gradio value lookup, lifted from the old SKILL.md (it was useful, just too long for SKILL.md).
- `src/go/internal/speaker/vits_speakers.json` — embedded copy of the canonical JSON. `update_speakers.py` maintains the sync.

---

## 4. End-to-end test results (vs live upstream)

Run timestamp: 2026-05-31 13:21 UTC. All 11 Go cases produced real audio:

| Case | Bytes | Notes |
|------|-------|-------|
| Default JP voice + ja text | 107,564 | `vits-tts "こんにちは、旅人さん"` |
| JP voice by alias (ayaka) | 26,668 | `-s ayaka -l ja` |
| JP voice by alias (ganyu) | 35,372 | `-s ganyu -l ja` |
| JP voice by exact string (胡桃) | 56,364 | `-s "日语胡桃（高桥李依）"` |
| CN voice exact (派蒙) | 48,172 | exact-before-alias rule firing |
| CN voice exact (钟离) | 43,052 | |
| Uma Musume (特别周) | 62,508 | |
| HI3 (爱莉希雅) | 48,684 | |
| Mix with markers | 52,780 | `[ZH]你好[ZH][JA]こんにちは[JA]` |
| Whisper preset | 173,612 | `--whisper` on 甘雨 |
| Speed override | 31,788 | `--speed 1.5` |

Bash function from SKILL.md §Path B: 3/3 cases pass (111,148 / 62,508 / 50,732 bytes).
Python recipe from SKILL.md §Path C: 3/3 cases pass (108,076 / 59,436 / 51,756 bytes).
Python package pytest: 50/50.
Go `go vet`: clean.

The warning paths also fired correctly:
- `-l mix` with raw Japanese text → pre-flight warning printed; output was 1,068 bytes; post-flight `IsLikelyEmptyWAV` warning printed.
- `-s 完全不存在的角色` → `unknown speaker` error + `--search-speakers` hint.

---

## 5. Known remaining issues / open questions

In rough priority order. Nothing here is a regression — these are open tasks.

### 5.1 — `HARD_ALIASES` still references ~30 non-existent characters

`update_speakers.py` `HARD_ALIASES` contains entries like `acheron`, `kafka`, `seele`, `bronya`, `welt`, `march7th`, `firefly`, `rem`, `kirito`, `nezuko`, `naruto`, `goku` whose targets are not in the current upstream `/config` dropdown. The script filters them out via `if target in choices`, so they cause no runtime damage — but they're dead weight. **Action**: prune `HARD_ALIASES` to only the ~50 that resolve, OR (better) point each romaji to a CN-name fallback when no JP voice exists upstream.

### 5.2 — Empty 556-byte WAV is still WRITTEN before the warning prints

In `cmd/vits-tts/main.go`, the warning runs AFTER `os.WriteFile`. So the user gets a tiny WAV on disk plus a stderr warning. Some agents trust the file-existence check and miss the warning. **Options**: (a) write to a temp path, check size, rename only if valid; (b) refuse to write if `IsLikelyEmptyWAV`; (c) use a non-zero exit code. Tradeoff: (b) breaks intentional silence-tests. Currently I lean (a) — atomic-write pattern — but didn't implement it because it's a behavior change that should be explicitly agreed.

### 5.3 — Python `tts.py` server doesn't apply the exact-before-alias resolver

`src/python/vits_tts_hf2api/speakers.py` (2 460 lines, not fully audited this session) has its own `resolve_speaker_gradio`. The order is alias-first there, so a Python server caller with `voice=派蒙` may still hit the JP voice when they probably want CN. **Action**: align the Python resolver with `internal/speaker/speaker.go`. Add a pytest case.

### 5.4 — `vits_speakers.json` is duplicated, not symlinked

Two copies: `references/vits_speakers.json` and `src/go/internal/speaker/vits_speakers.json`. `update_speakers.py` writes both, but a hand-edit (or a `git checkout` that touches only one) could desync. **Mitigation today**: the README says so explicitly and the update script is the only documented path. **Better fix**: post-build sanity check that fails the build if the two files have different SHA-256. Or: a `go generate` directive.

### 5.5 — JP voice + ZH text "fails" with HTTP 500 — this is upstream behavior, hint is heuristic

Sometimes the same combo *does* succeed (observed once during testing: `-s 日语甘雨 -l zh "你好"` returned a 27 KB WAV with weird pronunciation). The upstream is non-deterministic for this case. The Go hint always prints "speaker is JP-only ... try -l ja" when all 4 fail and the speaker begins with `日语` and language is `中文`. **Open question**: is this a transient bug we should retry harder, or genuinely model-side? No clear answer yet — would need a few hundred trials to be sure.

### 5.6 — Per-character VITS Space integration only in Python

`zomehwh-vits-models-genshin-bh3.hf.space` is supported by `src/python/vits_tts_hf2api/` (mapped via `fn_index` 0/5/10/15/20/25/30 + `sid`) but not by the Go binary. **Action**: add Go support, or document the Python path more visibly in SKILL.md.

### 5.7 — No upstream-availability monitoring

Nothing detects when a Space goes permanently down. Today the retry chain wears the symptom — every call adds ~5-10 s of failing-attempt latency. **Action**: a tiny `vits-tts --probe` mode that pings all 4 and exits with a status summary; or a TTL-cached health check in long-running calls.

### 5.8 — No cache

Same (text, speaker, lang, params) → same audio. Nothing memoizes. If an agent regenerates the same line 5 times, that's 5 upstream calls. **Action**: optional disk cache keyed by SHA-256 of the data array.

### 5.9 — Coverage gaps that aliases still imply

`HARD_ALIASES` claims `furina`, `dehya`, `alhaitham`, `layla`, `kaveh`, `faruzan`, `wanderer` etc. as Genshin characters. Upstream `/config` doesn't have them (model predates Sumeru 3.6+). Agents searching for those characters will see no match. **Action**: either (a) accept that the upstream model is frozen at 3.5 and document that ceiling clearly, or (b) wire in `zomehwh-vits-models-genshin-bh3` as a secondary backend that does cover some of these.

### 5.10 — Streaming WAV unsupported

Upstream returns WAV in one shot; client buffers the whole thing. For long text on cold upstream, this means a multi-second wait with no progress feedback. **Action**: chunked download via Range on `/file=`. Not blocking.

### 5.11 — No rate-limit awareness

We respect HTTP 429 by retrying, but don't back off or cap call rate. A burst of calls from one agent could provoke the upstream owner. **Action**: optional `--max-concurrency` + token-bucket.

### 5.12 — Trad/Simplified speaker name handling

A user typing `神里綾華` (Traditional 綾) hits "unknown speaker" because upstream uses Simplified `绫`. The substring resolver doesn't normalize. **Action**: optional OpenCC pre-normalization (T2S) before resolution.

### 5.13 — `Languages` map iteration in `ResolveLanguage`

For an unknown language key, `ResolveLanguage` falls through to "return key" — so a user passing `中文` directly works, but a typo like `中問` would silently send garbage upstream. **Action**: list valid options when no match.

### 5.14 — Test isolation for Python tests when run via uv

`uv run pytest` re-imports config on a fresh interpreter, so env-var-based reload tests work in isolation but interleave oddly with other tests. Today tests pass; if we ever add env-var-driven defaults to the resolver, this can bite.

### 5.15 — `mix` auto-wrap

When `-l mix` is given and the text contains both CJK ranges, the binary could auto-insert `[ZH]/[JA]` markers around language runs. Not implemented — current behavior just warns. **Trade-off**: auto-wrap could surprise users who *intended* the raw text and wanted to send it through mix mode for some other reason. Probably better left manual + warned.

---

## 6. Anti-patterns to avoid (recap)

The set we explicitly fixed AND must not re-introduce:

1. Don't write `case map[string]any:` after a failed `map[string]any` type assertion — unreachable.
2. Don't default language to `mix` — silent failure for plain text.
3. Don't put alias-resolution before exact-upstream-match — hijacks user-typed CN names to JP voices.
4. Don't strip `session_hash` for AHJoong/OldSecond REST — HTTP 422.
5. Don't trust `data[0] == "生成成功!"` as a success signal — degenerate 556-byte WAVs come with the same string.
6. Don't drop `fn_index: 0` from REST/WS payloads — ikechan8370 tolerates it but the others may not.
7. Don't promise voices outside the coverage truth table.
8. Don't reference paths outside the Go module from `//go:embed` — that's why the JSON is duplicated, with `update_speakers.py` enforcing sync.
9. Don't raise text limits past 500 / 100 runes — upstream truncates server-side.

---

## 7. Verification recipe (for the next maintainer)

To check that nothing has regressed after a future change:

```bash
cd /home/df/workspace/hf2api/vits-tts-hf2api

# Static checks
cd src/go && go vet ./... && cd ../..
uv run pytest -q tests/

# Build
cd src/go && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
cd ../..

# Smoke
./vits-tts --version
./vits-tts --list-languages
./vits-tts --search-speakers 神里

# Live upstream E2E (each must produce ≥ 5 KB WAV)
for case in \
  '"こんにちは、旅人さん"' \
  '"你好旅行者" -s 派蒙 -l zh' \
  '"今日もよろしく" -s "日语胡桃（高桥李依）" -l ja' \
  '"今天也要努力训练" -s 特别周 -l zh' \
  '"[ZH]你好[ZH][JA]こんにちは[JA]" -l mix' \
  ; do
  eval ./vits-tts $case -o /tmp/probe.wav -q
  sz=$(wc -c < /tmp/probe.wav)
  [ "$sz" -gt 5000 ] && echo "OK $sz: $case" || echo "FAIL $sz: $case"
done

# Verify the warning paths fire
./vits-tts "おはよう" -l mix 2>&1 | grep -q 'language=mix needs' && echo "OK mix warning"
./vits-tts "你好" -s 日语甘雨（上田丽奈） -l zh 2>&1 | grep -q 'JP-only voice' && echo "OK JP+ZH hint"
./vits-tts "..." -s 完全不存在的角色 2>&1 | grep -q 'unknown speaker' && echo "OK unknown speaker"
```

If any line says FAIL, check whether the upstream Space is reachable before changing code.

---

## 8. Decisions deliberately deferred

- **Atomic-write for the empty-WAV case** — discussed in §5.2. Behavior change; needs explicit user OK.
- **Pruning `HARD_ALIASES`** — discussed in §5.1. Cosmetic; doesn't affect runtime.
- **Per-character Space in Go** — §5.6. Scope creep for this audit.
- **Cache** — §5.8. Useful but not aligned with the "fix what's broken" remit.
- **OpenCC trad-simp normalization** — §5.12. Adds a heavy dep for a niche case.
