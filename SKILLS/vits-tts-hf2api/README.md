# vits-tts-hf2api — maintainer guide

This file is for whoever has to **extend, debug, or update** the skill — not for the agent calling it. Agents read `SKILL.md`. If you only want to use the TTS, start there.

Everything below has been verified against the live HuggingFace Spaces as of the last commit. When upstream changes, re-run the probes documented in §Upstream behavior, update §Known facts, and bump `vits-tts/cmd/vits-tts/main.go`'s `version`.

---

## 1. Layout

```
vits-tts-hf2api/
├── SKILL.md                       # agent-facing docs (the only file the LLM reads)
├── README.md                      # ← this file
├── vits-tts                       # pre-built static Go binary (~6 MB)
├── update_speakers.py             # refresh upstream catalog → writes BOTH JSON copies
├── references/
│   ├── vits_speakers.json         # canonical speaker list (~22 KB, 804 entries + ~140 aliases)
│   └── seiyuu_table.md            # Genshin JP cast → Gradio value lookup
├── src/
│   ├── go/
│   │   ├── go.mod
│   │   ├── cmd/vits-tts/main.go   # CLI entry point
│   │   └── internal/
│   │       ├── client/
│   │       │   ├── rest.go         # /api/generate/ + /file= download
│   │       │   ├── ws.go           # /queue/join protocol (zomehwh)
│   │       │   └── retry.go        # 4-stage retry chain
│   │       ├── config/config.go    # URLs, defaults
│   │       └── speaker/
│   │           ├── data.go              # //go:embed JSON + Languages map + constants
│   │           ├── speaker.go           # ResolveSpeakerDetailed + Search + List
│   │           └── vits_speakers.json   # embedded copy — kept in sync by update_speakers.py
│   └── python/vits_tts_hf2api/    # optional OpenAI-shaped server (`/v1/audio/speech`)
│       ├── __init__.py            # aiohttp app, CORS + Bearer auth
│       ├── tts.py                 # /v1/audio/speech handler
│       ├── rest_client.py         # ikechan8370 / AHJoong / OldSecond REST
│       ├── ws_client.py           # zomehwh WS
│       ├── retry.py               # multi-URL retry chain
│       ├── speakers.py            # 2k-line SPEAKER table, alias resolution, per-character map
│       └── config.py              # env-var driven config
└── tests/                         # 50 pytest cases (Python only)
```

## 2. Upstream Spaces — verified behavior

There are four sibling HuggingFace Spaces in the retry chain. **They share the same 804-speaker VITS model and the same Gradio dropdown choices.** Differences are protocol-level only.

### Endpoints

| Space | Transport | Auth on `/api/generate/` | Notes |
|-------|-----------|--------------------------|-------|
| `ikechan8370-vits-uma-genshin-honkai.hf.space` | REST POST | `session_hash` optional, `fn_index` optional | The default, warmest |
| `AHJoong-vits-uma-genshin-honkai.hf.space` | REST POST | `session_hash` **required** (HTTP 422 otherwise) | Cold start ~20 s |
| `OldSecond-vits-uma-genshin-honkai.hf.space` | REST POST | `session_hash` **required** | Occasionally returns an **empty body** when cold — must be treated as retriable |
| `zomehwh-vits-uma-genshin-honkai.hf.space` | WebSocket `/queue/join` only | session_hash in queue protocol | REST path returns `{"detail":"Not authorized to skip the queue"}`. 100-char text limit on this Space |

A separate Space, `zomehwh-vits-models-genshin-bh3.hf.space`, offers **per-character models** keyed by `fn_index` (0/5/10/15/20/25/30) + an integer `sid`. Only `src/python/vits_tts_hf2api/` targets this Space (via `config.VITS_MODELS_URL` and `speakers.resolve_vits_model_speaker`). The Go binary and the copy-paste recipes do not.

### REST request — exact wire format

```http
POST /api/generate/ HTTP/2
Host: ikechan8370-vits-uma-genshin-honkai.hf.space
Content-Type: application/json

{
  "fn_index": 0,
  "session_hash": "abcdef12345",       // required for AHJoong, OldSecond
  "data": [
    "<text>",                            // [0]
    "<language Gradio string>",          // [1] 中文 / 日语 / 中日混合（...）
    "<speaker Gradio string>",           // [2]
    0.6,                                 // [3] noise_scale
    0.668,                               // [4] noise_scale_w
    1.2                                  // [5] length_scale
  ]
}
```

Success response (`HTTP 200`):

```json
{
  "data": [
    "生成成功!",
    {"name":"/tmp/tmpXXX/tmpYYY.wav","data":null,"is_file":true},
    "生成耗时 0.83 s"
  ],
  "is_generating": false,
  "duration": 0.83,
  "average_duration": 4.17
}
```

`data[1]` can also be a plain string (`/tmp/...wav`) on older Gradio forks. The Go REST client handles both.

Then `GET /file=<that path>` returns the raw WAV (`audio/wav`, RIFF mono 22050 Hz 16-bit PCM, typically 20-200 KB).

### Failure modes you will hit

| HTTP / payload | Cause | Action |
|----------------|-------|--------|
| 200 `{"error":null}` (no `data` key) | Upstream silently rejected input — usually a JP-only voice given Chinese text | Treat as a hard failure; surface to the user. Hint at JP+ZH mismatch. |
| 200 with 556-byte WAV | `mix` language without `[ZH]/[JA]` markers, or model failed to generate audio | `IsLikelyEmptyWAV(b) = isWAV(b) && len(b) < 2048`. Warn the user. |
| 200 empty body | OldSecond cold | Retriable; treat as 503 internally |
| **HTTP 500** `{"error":null}` | JP-only voice + Chinese text → every upstream returns 500 | Retriable per HTTP rules, but exhausts the chain — show the JP+ZH hint |
| HTTP 422 | `session_hash` missing on AHJoong/OldSecond | Always send a session_hash on backups |
| HTTP 429 | Rate-limited | Retriable, fall through |
| HTTP 4xx (other) | Bad input | Non-retriable, bail out |
| WS `queue_full` | Too many concurrent users | Non-retriable on this call; tell user to retry |

### WebSocket protocol (zomehwh)

```
client → wss://zomehwh-vits-uma-genshin-honkai.hf.space/queue/join

server: {"msg":"send_hash"}
client: {"session_hash":"<11 chars>", "fn_index":0}
server: {"msg":"estimation", ...}        # 0..N — ignore
server: {"msg":"send_data"}
client: {"data":[...], "fn_index":0, "session_hash":"<same>"}
server: {"msg":"process_starts"}          # ignore
server: {"msg":"process_completed", "output":{"data":["生成成功!", "data:audio/wav;base64,..."]}}
```

`output.data[1]` is a `data:audio/wav;base64,...` data URI. Base64-decode the substring after the first comma.

Some forks return `output.data[1] = {"name":"/tmp/xxx.wav","data":null}` instead — fetch via `GET /file=<name>` against the HTTPS counterpart. The Go and Python clients handle both shapes.

The public zomehwh Space caps text at **100 runes** (rune count, not bytes). The Go retry layer enforces this before the WS call.

## 3. Five critical-knowledge gotchas

These are the same five surfaced in SKILL.md, repeated here because they're what breaks the skill when upstream drifts:

1. **Speaker must be the exact Gradio dropdown string.** Integer IDs ARE NOT stable. Traditional Chinese (`綾`) ≠ Simplified (`绫`).
2. **Language values are Simplified Chinese Gradio strings**: `中文`, `日语` (NOT `日本語`), `中日混合（...）`.
3. **`mix` requires `[ZH]...[ZH]` / `[JA]...[JA]` markers.** Without them, upstream returns a 556-byte syntactically-valid WAV with no audible speech.
4. **JP-only voices (`日语...` prefix) reject Chinese text with HTTP 500 across all four upstreams.** Pair JP voices with `日语`.
5. **Cold-start is 20-40 s.** The retry chain absorbs this, but `--list-speakers` from upstream can return empty if all four sleep.

## 4. Coverage truth table

What this skill actually has, and what it does NOT.

| Has | Doesn't |
|-----|---------|
| Genshin Impact (all CN + JP) up to ~3.5 (Sumeru) | Genshin 4.0+ (芙宁娜, 那维莱特, 雷诺尔, …) |
| Honkai Impact 3rd (major valkyries + 律者 forms) | Star Rail (卡芙卡, 流萤, 黄泉, 希儿 — except 希儿 which collides with HI3 character of same name) |
| Uma Musume (~80 horse-girls) | Wuthering Waves, ZZZ |
| Genshin NPCs (hundreds, 千岩军/愚人众/etc.) | Re:Zero, SAO, AOT, Demon Slayer, Fate, Vocaloid |

The `HARD_ALIASES` map in `update_speakers.py` has ~30 entries pointing at characters that don't exist upstream. They're filtered out by the `if target in choices` guard, so they cause no runtime damage — but if you regenerate the JSON, expect those aliases to remain absent.

## 5. Updating the speaker list

Whenever an upstream Space adds or removes characters:

```bash
python3 update_speakers.py
# Writes BOTH:
#   references/vits_speakers.json
#   src/go/internal/speaker/vits_speakers.json   (embedded into the binary)
cd src/go && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
```

The script pulls `/config` from ikechan8370, finds component id=13 (the speaker dropdown), and writes:

```json
{
  "choices": [...],            // 804 exact Gradio strings, upstream order
  "aliases": {...},            // auto-derived short names + HARD_ALIASES (filtered)
  "count": 804,
  "alias_count": ~140,
  "generated_from": "..."
}
```

Auto-aliases work like this: for each `日语<name>（<seiyuu>）`, drop the `日语` prefix and the parens to get `<name>`, then map `<name> → 日语<name>（<seiyuu>）`. That's why typing `-s 甘雨` resolves to the JP voice. CN-only characters (no parens, no `日语` prefix) end up as exact upstream matches — and `ResolveSpeakerDetailed` prefers exact matches over aliases.

To add a new English/romaji alias, edit `HARD_ALIASES` in `update_speakers.py` and re-run.

## 6. Speaker resolution algorithm (Go binary)

```
ResolveSpeakerDetailed(name) returns (Resolved, Kind):

  if name == ""                                      → (DefaultSpeaker, "default")
  if name in UpstreamChoices                         → (name, "exact")            ← wins over alias
  if lowercase(name) matches an UpstreamChoice       → (..., "case-insensitive")
  if name in SpeakerAliases                          → (target, "alias")
  if lowercase(name) matches an alias key            → (target, "alias")
  if len(name) >= 2 and name is prefix of a choice   → (..., "prefix")
  if name is substring of a choice                   → (..., "substring")  ← deterministic, slice order
  otherwise                                          → ("", "")
```

`ResolveSpeakerDetailed` reports the kind so the CLI can show `(resolved "X" via Y match)` for non-exact resolves — a hint that the user typed something fuzzy.

The exact-before-alias ordering matters: `派蒙`, `琴`, `刻晴`, `安柏`, etc. exist verbatim as **CN** voices in `UpstreamChoices`, and would otherwise be hijacked by the JP alias from `auto_aliases`. Be careful before reordering this.

## 7. Defaults — and why each

| Setting | Default | Reason |
|---------|---------|--------|
| Speaker | `日语神里绫华（早见沙织）` | Most-requested voice; JP voice (paired with `ja` default) |
| Language | `ja` | `mix` is silently broken without markers (gotcha #3); the default speaker is JP |
| `noise_scale` | 0.6 | Upstream Gradio default |
| `noise_scale_w` | 0.668 | Upstream default |
| `length_scale` | 1.2 | Slightly slower than 1.0 → easier to understand |
| Timeout | 2 min | Cold start + generation + download fits in this |

Changing the default speaker requires updating **three** places to stay consistent:
1. `src/go/internal/config/config.go` `NewConfig`
2. `src/go/internal/speaker/data.go` `DefaultSpeaker`
3. `src/python/vits_tts_hf2api/config.py` `DEFAULT_SPEAKER`
4. `tests/test_config.py` `test_defaults`
5. `SKILL.md` (the §Default speaker block and the flag table)

## 8. Build, test, and release

### Go binary

```bash
cd src/go
go vet ./...                     # static analysis (passes clean)
CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
```

Strip + go:embed → ~6 MB static binary, no runtime files needed.

### Python package

```bash
uv run pytest -q tests/          # 50 cases, all passing
uv run python -m vits_tts_hf2api # spins up the OpenAI-shaped server on $PORT (default 80)
```

### End-to-end against live upstream

The Bash block below is the regression suite. Each case must produce a WAV ≥ 5 KB to count as a pass.

```bash
run_case() {
  ./vits-tts "$@" -o "/tmp/$1.wav" >/dev/null 2>&1
  local sz=$(wc -c < "/tmp/$1.wav" 2>/dev/null)
  [ "$sz" -gt 5000 ] && echo "[PASS] $1 ($sz)" || echo "[FAIL] $1 ($sz)"
}

run_case default       "こんにちは、旅人さん"
run_case alias_ayaka   "やあ" -s ayaka -l ja
run_case alias_ganyu   "おはよう" -s ganyu -l ja
run_case exact_jp      "今日もよろしく" -s "日语胡桃（高桥李依）" -l ja
run_case cn_paimon     "你好旅行者" -s 派蒙 -l zh
run_case cn_zhongli    "契约成立" -s 钟离 -l zh
run_case uma_special   "今天也要努力训练" -s 特别周 -l zh
run_case hi3_eli       "为了爱莉希雅" -s 爱莉希雅 -l zh
run_case mix           "[ZH]你好[ZH][JA]こんにちは[JA]" -l mix
run_case whisper       "ふわぁ…朝ですか" -s "日语甘雨（上田丽奈）" -l ja --whisper
run_case speed         "早く話します" -s "日语胡桃（高桥李依）" -l ja --speed 1.5
```

All 11 pass against the current live Spaces.

## 9. Anti-patterns — things to NOT do

- **Don't add `case map[string]any:` after a failed `map[string]any` type-assertion.** That branch is unreachable. We had it once.
- **Don't default the language to `mix`.** It silently breaks plain text. We had it once.
- **Don't reorder alias-first in `ResolveSpeakerDetailed`.** Users typing exact CN names get hijacked to JP voices. We had it once.
- **Don't strip `session_hash` for `AHJoong` / `OldSecond` calls** — both return HTTP 422 without it.
- **Don't trust `data[0]` being `"生成成功!"`** as a signal of audio bytes — empty 556-byte WAVs are also returned with that string. Check WAV length AFTER download.
- **Don't drop `fn_index: 0`** from REST payloads or WS payloads. ikechan8370 tolerates omitting it; the others may not, and Gradio Spaces are free to change behavior at any update.
- **Don't promise voices outside §4 coverage.** Star Rail / SAO / Vocaloid / etc. trigger requests this skill cannot satisfy.
- **Don't reference paths outside the Go module from `//go:embed`.** That's why the JSON is duplicated under `src/go/internal/speaker/` — `update_speakers.py` is responsible for keeping them in sync.
- **Don't expand text-length limits past 500 / 100 runes.** Upstream truncates server-side beyond that; clients silently sending more produce cut audio.
- **Don't `cd` into worktrees in this repo without checking `.claude/worktrees/`.** Not specific to this skill, just a general workspace caution.

## 10. Roadmap

Items not implemented yet, in priority order:

1. **Per-character model wrapper in Go.** `zomehwh-vits-models-genshin-bh3.hf.space` offers higher fidelity for specific characters via `fn_index`/`sid`. Only Python supports it today.
2. **Auto-wrap `mix` input.** If text contains both CJK ranges and `-l mix` is set, auto-insert `[ZH]/[JA]` markers around language runs.
3. **Streaming responses.** Upstream sends WAV in one shot. Could chunk via Range requests on `/file=`.
4. **Local cache.** Same (text, speaker, lang, params) → memoize the WAV. SHA-256 keying.
5. **Python `vits_tts_hf2api` server**: align resolver with Go (exact-before-alias). Currently does the opposite.
6. **Update `HARD_ALIASES`** to drop the ~30 entries pointing at non-existent characters, so the alias count cleanly reflects coverage.

## 11. License & attribution

The upstream HuggingFace Spaces are not owned by this repo. Their availability is out of our control — if they go down, this skill goes down. Models are MIT-style upstream; respect each Space's posted terms.
