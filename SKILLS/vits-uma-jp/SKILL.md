---
name: vits-uma-jp
description: Reverse-engineered API reference for VITS-UMA multilingual TTS (804 voices: Uma Musume, Genshin Impact CN/JP, Honkai Impact 3rd, 439+ Genshin NPCs), served via a custom OpenAI-compatible wrapper over the Gradio 3.7 websocket interface at zomehwh/vits-uma-genshin-honkai. Use when the user mentions VITS-UMA, Genshin TTS, 原神语音, 赛马娘TTS, 崩坏3 TTS, anime TTS, Japanese/Chinese character voice synthesis, or needs to generate speech using game character voices. Also use for reverse-engineering Gradio 3.7 Spaces, debugging websocket-based TTS, or integrating character voices into applications.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# vits-uma-jp

OpenAI-compatible TTS API reverse-engineered from **VITS-UMA** (804-voice multilingual model covering Uma Musume, Genshin Impact, and Honkai Impact 3rd) hosted at HuggingFace Space `zomehwh/vits-uma-genshin-honkai`.

## What This Skill Covers

The VITS-UMA Space runs Gradio 3.7 with `show_api: false` — there is no REST endpoint. This skill documents the complete reverse engineering, the upstream model's actual interface (3 language modes, 804 speakers by index, VITS parameters), the wrapper design, and everything needed to recreate or operate the API.

## TTS Skill Decision Tree

```
Need speech synthesis?
├─ Japanese, anime/game character voice? → THIS SKILL
├─ Chinese, game character voice? → THIS SKILL (same model supports 中文)
├─ Chinese or multilingual, no character constraint? → qwen-tts2api
└─ Need long-form narration (>100 chars)? → qwen-tts2api (VITS-UMA limits to 100 chars on HF)
```

## Upstream Model: Complete Interface Specification

### Source Space

`zomehwh/vits-uma-genshin-honkai` — Gradio 3.7, `cpu-basic`, `concurrency_count=1`, `api_open=False` by default.

### Function Signature (from app.py)

```python
def vits(text, language, speaker_id, noise_scale, noise_scale_w, length_scale):
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Input text. Newlines/spaces are stripped. On HF Spaces, limited to 100 chars. |
| `language` | int (dropdown index) | 0=中文, 1=日语, 2=中日混合 |
| `speaker_id` | int (dropdown index) | 0–803. Index into the 804-speaker list from `config.json`. NOT a name string. |
| `noise_scale` | float | Emotion/expressiveness variance. Slider 0.1–1.0, step 0.1 |
| `noise_scale_w` | float | Phoneme duration variance. Slider 0.1–1.0, step 0.1 |
| `noise_scale_w` | float | Phoneme duration variance. Slider 0.1–1.0, step 0.1 |
| `length_scale` | float | Speech speed multiplier. Slider 0.1–2.0, step 0.1. **Inverted: higher = slower.** |

### Language Modes — Text Preprocessing

The `language` parameter controls how text is wrapped before phonemization:

| Language Index | Name | Text Transformation | Default Params |
|---------------|------|---------------------|----------------|
| 0 | 中文 | `[ZH]{text}[ZH]` | ns=0.6, nsw=0.668, ls=1.2 |
| 1 | 日语 | `[JA]{text}[JA]` | ns=0.6, nsw=0.668, ls=1.1 |
| 2 | 中日混合 | No auto-wrap; user must manually wrap: `[ZH]中文部分[ZH][JA]日本語部分[JA]` | ns=0.6, nsw=0.668, ls=1.1 |

Key difference: Chinese default `length_scale` is 1.2; Japanese is 1.1. These are set by the `change_lang()` callback when the user switches language in the Gradio UI. When calling via API, you must set these yourself.

### length_scale Semantics — CRITICAL

`length_scale` controls phoneme duration. **It is NOT a speed multiplier — it is a duration multiplier.**

- `length_scale > 1.0` → each phoneme is longer → speech is **slower**
- `length_scale < 1.0` → each phoneme is shorter → speech is **faster**
- Default Chinese: 1.2 (slower than real-time)
- Default Japanese: 1.1 (slightly slower)

If you want faster speech, **decrease** `length_scale`. If you want slower speech, **increase** it.

### Speaker Catalog

**804 speakers**, organized in 6 categories. Speaker selection uses **integer index** (0–803), not name strings.

| Category | Index Range | Count |
|----------|-------------|-------|
| 赛马娘 / Uma Musume | 0–86 | 87 |
| 原神中文 / Genshin Impact (Chinese) | 87–173 | 87 |
| 崩坏3 / Honkai Impact 3rd | 174–239 | 66 |
| 原神NPC (中文) / Genshin NPCs | 240–299 | 60 |
| 日语原神 / Genshin Impact (Japanese) | 300–364 | 65 |
| 原神NPC续 / Genshin NPCs continued | 365–803 | 439 |

For the complete speaker-by-speaker table, read **`references/speakers.md`**.

### Popular Speakers Quick Reference

| Character | Index | Category | Voice Actor |
|-----------|-------|----------|-------------|
| 琪亚娜 (Kiana) | 228 | Honkai 3 | — (default speaker in Gradio UI) |
| 神里绫华 (CN) | 87 | Genshin CN | — |
| 神里绫华 (JP) | 303 | Genshin JP | Hayami Saori (早見沙織) |
| 胡桃 (CN) | 119 | Genshin CN | — |
| 胡桃 (JP) | 324 | Genshin JP | Takahashi Rie (高橋李依) |
| 雷电将军 (CN) | 125 | Genshin CN | — |
| 雷电将军 (JP) | 342 | Genshin JP | Sawashiro Miyuki (沢城みゆき) |
| 钟离 (CN) | 104 | Genshin CN | — |
| 钟离 (JP) | 364 | Genshin JP | Maeno Tomoaki (前野智昭) |
| 八重神子 (JP) | 359 | Genshin JP | Sakura Ayane (佐倉綾音) |
| 刻晴 (CN) | 115 | Genshin CN | — |
| 刻晴 (JP) | 328 | Genshin JP | Kitamura Eri (喜多村英梨) |
| 北部玄驹 (Kitasan) | 67 | Uma Musume | — |

**Important**: The same character appears at different indices for Chinese vs Japanese voice lines. CN and JP voices are **different recordings with different voice actors**. Use the index that matches your language mode.

### Text Length Limitation

On HuggingFace Spaces (`limitation = os.getenv("SYSTEM") == "spaces"`), input text is **hard-limited to 100 characters**. Text exceeding 100 chars returns an error message instead of audio. This limit does NOT apply when running the model locally.

## Reverse Engineering: Gradio 3.7 Websocket Protocol

### Why a Wrapper Is Needed

Gradio 3.7 spaces with `show_api: false` expose **no HTTP REST endpoint**. The only access path:

1. Open a websocket to the Space
2. Send a predict call with `api_name` (typically `/predict`)
3. Receive result via websocket
4. Download the audio file from the Space's file server

This means raw `curl` or HTTP clients **cannot** call the Space directly.

### gradio_client Version Constraint — CRITICAL

| gradio_client version | Gradio 3.7 compatible | Notes |
|----------------------|----------------------|-------|
| `0.x` (<1.0) | **Yes** | Websocket protocol matches Gradio 3.7 |
| `2.x` (>=2.0) | **No** | Different serialization format |

These versions use fundamentally different websocket protocols. They **cannot** coexist in one Python environment or Docker network namespace sharing pip.

If you see `"No api_name found"`, `"Unexpected message type"`, or websocket failures, check `gradio_client` version first.

### Reverse Engineering Steps (Generalized for Any Gradio 3.7 Space)

1. **Identify Space**: `zomehwh/vits-uma-genshin-honkai`
2. **Connect with gradio_client 0.x**:
   ```python
   from gradio_client import Client
   client = Client("zomehwh/vits-uma-genshin-honkai")
   ```
3. **Discover API**: `client.view_api()` reveals function name, parameter names, and types
4. **Extract config**: The Space's `config.json` (downloadable from HF) contains the full speaker list
5. **Call the function**:
   ```python
   result = client.predict(
       text="こんにちは",
       language=1,          # 0=CN, 1=JP, 2=mixed
       speaker_id=324,      # index into 804-speaker list
       noise_scale=0.6,
       noise_scale_w=0.668,
       length_scale=1.1,
       api_name="/predict"
   )
   # result = (message_str, (22050, numpy_array), timing_str)
   ```
6. **Wrap in HTTP server**: Accept OpenAI-format requests, translate to the above call

### Stochastic Nature of VITS

From the upstream UI: "结果有随机性，语调可能很奇怪，可多次生成取最佳效果" (Results are stochastic; intonation may be odd; generate multiple times for best results).

Identical parameters produce **different intonations** across calls. The `noise_scale` parameters control the variance of the latent sampling. For best results, generate 2–3 times and select the preferred output.

## Wrapper API Contract

### GET /v1/models

Returns model metadata and the voice catalog.

```bash
curl -s http://<host>:<port>/v1/models
```

Response structure depends on the wrapper implementation. The voice catalog may be filtered by language (e.g., JP-only voices) or include all 804 speakers.

### POST /v1/audio/speech

```bash
curl -s -X POST http://<host>:<port>/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "input": "こんにちは",
    "voice": "胡桃",
    "speed": 1.0,
    "noise_scale": 0.5,
    "noise_scale_w": 0.668
  }' \
  -o output.wav
```

**Note**: The wrapper translates `voice` (name string) to the correct speaker index internally. The mapping depends on the wrapper's language filter configuration (`LANGUAGE` env var). If `LANGUAGE=日语`, only JP voices (indices 300–364) are available.

#### Parameters

| Parameter | Required | Type | Description | Range | Upstream Default |
|-----------|----------|------|-------------|-------|---------|
| `input` | Yes | string | Text to synthesize | ≤100 chars on HF | — |
| `voice` | Yes | string | Speaker name (wrapper-dependent key format) | See /v1/models | — |
| `speed` | No | float | **Duration** multiplier (higher = slower). Maps to `length_scale`. | 0.1–2.0 | 1.2 (CN) / 1.1 (JP) |
| `noise_scale` | No | float | Emotion variance | 0.1–1.0 | 0.6 |
| `noise_scale_w` | No | float | Phoneme duration variance | 0.1–1.0 | 0.668 |

### GET /health

Returns `{"status": "ok", "voices": <count>}`. Voices count of 0 means startup initialization is still loading.

## Parameter Tuning Guide

### For Whispered/Intimate Tone

```json
{"noise_scale": 0.3, "noise_scale_w": 0.668, "speed": 0.85}
```

Low `noise_scale` constrains emotion → flatter, quieter intonation. Slow `speed` (low `length_scale`) stretches delivery. Actually — **correction**: since `speed` maps to `length_scale`, and `length_scale > 1` means slower, you want `speed` **> 1.0** for slower delivery in intimate tone, NOT < 1.0.

**Corrected for intimate tone:**
```json
{"noise_scale": 0.3, "noise_scale_w": 0.668, "speed": 1.4}
```

### For Dramatic/Expressive Tone

```json
{"noise_scale": 0.8, "noise_scale_w": 0.75, "speed": 1.1}
```

High `noise_scale` allows wider emotion swings.

### For Fast/Casual Tone

```json
{"noise_scale": 0.5, "noise_scale_w": 0.668, "speed": 0.9}
```

Lower `speed` → shorter phoneme duration → faster speech.

### Boundary Warnings

- `noise_scale > 0.9`: unstable/glitchy audio — clipping, pitch jumps, robotic artifacts
- `length_scale < 0.5` (`speed < 0.5`): severely distorted, syllables dropped
- `length_scale > 1.8` (`speed > 1.8`): extremely slow, may sound unnatural
- `noise_scale_w < 0.2`: monotone, robotic rhythm
- Punctuation **affects output**: the model processes punctuation as part of the input; different punctuation produces different intonation patterns

## Wrapper Implementation

Source code in **`scripts/`**:

- `scripts/app.py` — aiohttp server with gradio_client 0.x integration
- `scripts/Dockerfile` — container build recipe

### Key Design Decisions

1. **aiohttp**: handles concurrent HTTP while `gradio_client.predict()` blocks. `asyncio.to_thread()` offloads each call to a thread pool.

2. **Threading Lock**: `gradio_client.Client.predict()` is not thread-safe. A `threading.Lock` serializes all synthesis calls. Throughput limited to ~1 request at a time (matches free-tier Space queue).

3. **Client TTL**: connection recreated every 5 minutes to avoid stale websocket sessions.

4. **Voice init on startup**: queries Space config at boot. If Space is sleeping, `/health` returns `voices: 0` until init completes (30–60s).

### Building from Scratch

```bash
docker build -t vits-uma-api:latest -f scripts/Dockerfile scripts/
docker run -d --name vits-uma-api \
  --restart=unless-stopped \
  -e HTTP_PORT=8080 \
  -e LANGUAGE=日语 \
  vits-uma-api:latest
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `80` | Listen port |
| `LANGUAGE` | `日语` | Language filter prefix for voice catalog. Options: `日语` (JP Genshin, indices 300–364), or leave empty for all 804 speakers |
| `BASE_URL` | `zomehwh/vits-uma-genshin-honkai` | HuggingFace Space identifier |

## Error Matrix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `health` returns `voices: 0` | Startup init still loading | Wait 10–15s, retry |
| HTTP 500 | Space sleeping or queue full | Wait 30–60s for Space to wake |
| `Unknown voice` | Voice key doesn't match wrapper's catalog | Query `/v1/models`; verify `LANGUAGE` filter |
| `TypeError: object NoneType can't be used in 'await'` | aiohttp on_startup incompatibility with Python 3.13 | Ensure startup callbacks are async functions returning None |
| Port conflict | Another service on same port | Change `HTTP_PORT` |
| gradio_client connection errors | Wrong gradio_client version | Must use `<1` (0.x) |
| `输入文字过长！N>100` | Text exceeds HF Spaces limit | Shorten to ≤100 chars |

## NEVER

- **NEVER** use `gradio_client>=1` — incompatible with Gradio 3.7 websocket protocol
- **NEVER** co-locate with qwen-tts2api on same Docker network namespace — conflicting gradio_client versions
- **NEVER** assume `speed` < 1.0 means slower — `length_scale` is a duration multiplier; higher = slower, lower = faster
- **NEVER** send text >100 chars to HF-hosted Space — hard limit returns error instead of audio
- **NEVER** set `noise_scale > 0.9` — produces unstable/glitchy audio
- **NEVER** assume deterministic output — VITS is stochastic; same parameters yield different intonation
- **NEVER** hardcode voice indices from memory — verify against `/v1/models` or `config.json` as upstream may update
- **NEVER** ignore punctuation — it directly affects the model's intonation output
- **NEVER** assume CN and JP voices for the same character share an index — they are at different positions (e.g., 胡桃 CN=119, 胡桃 JP=324)
