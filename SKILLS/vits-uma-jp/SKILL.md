---
name: vits-uma-jp
description: Reverse-engineered API reference for VITS-UMA Genshin Impact Japanese voice TTS (65 JP-dubbed character voices), served via a custom OpenAI-compatible wrapper over the Gradio 3.7 websocket interface. Use when the user mentions Genshin TTS, VITS-UMA, 原神日配, anime TTS, Japanese character voice synthesis, or needs to generate Japanese speech using Genshin Impact character voices (Ayaka, Hutao, Raiden Shogun, Zhongli, Yae Miko, etc.). Also use for reverse-engineering Gradio 3.7 Spaces, debugging websocket-based TTS, or integrating anime character voices into applications.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# vits-uma-jp

OpenAI-compatible TTS API reverse-engineered from **VITS-UMA** (Genshin Impact / Honkai: Star Rail Japanese voice model) hosted at HuggingFace Space `zomehwh/vits-uma-genshin-honkai`.

This skill documents the full reverse-engineering process, the resulting API contract, the 65 JP voice catalog, and parameter tuning — everything needed to recreate the wrapper from scratch without depending on any pre-built artifact.

## What This Skill Covers

The VITS-UMA model lives behind a Gradio 3.7 Space with **no REST endpoint** (`show_api: false`). This skill documents:
- The reverse engineering of the Gradio 3.7 websocket protocol
- The resulting OpenAI-compatible API contract
- The custom wrapper design (aiohttp + gradio_client 0.x)
- The 65-voice JP catalog with voice actor attribution
- VITS parameter tuning for specific speech effects
- Failure modes inherent to the upstream Space

## TTS Skill Decision Tree

```
Need speech synthesis?
├─ Japanese, anime/Genshin character voice? → THIS SKILL
├─ Chinese or multilingual? → qwen-tts2api
├─ Need specific voice acting / character tone? → THIS SKILL
└─ Need long-form narration (>100 chars)? → qwen-tts2api (VITS-UMA has ~100 char limit)
```

## Upstream Reverse Engineering

### Source Space

`zomehwh/vits-uma-genshin-honkai` on HuggingFace.

The Space exposes a Gradio 3.7 interface with:
- **Input**: text (string), language (dropdown: 日语/英语/...), character (dropdown filtered by language), noise_scale, noise_scale_w, speed
- **Output**: audio file (filepath)
- **Protocol**: Gradio 3.7 websocket only — `show_api: false` means no `/api/` REST routes exist

### Why a Wrapper Is Needed

Gradio 3.7 spaces with `show_api: false` cannot be called via HTTP. The only access path is through `gradio_client`'s websocket protocol, which:

1. Opens a persistent websocket to the Space
2. Sends a predict call with the function's `api_name`
3. Receives the result (audio filepath) via the same websocket
4. Downloads the audio file from the Space's file server

This means a raw `curl` or HTTP client **cannot** call the Space directly. The wrapper bridges this by:
- Accepting standard OpenAI-format HTTP requests
- Translating them to `gradio_client` websocket calls internally
- Returning the audio as a standard HTTP response

### Critical Gradio 3.7 Constraint: gradio_client Version

| gradio_client | Gradio 3.7 compatibility | Use with |
|---------------|--------------------------|----------|
| `0.x` (<1.0) | **Compatible** — websocket protocol matches | THIS wrapper |
| `2.x` (>=2.0) | **Incompatible** — different serialization format | qwen-tts2api |

The two versions use fundamentally different websocket protocols. They **cannot** coexist in the same Python environment or on the same Docker network namespace sharing a single pip install.

If you see errors like `"No api_name found"`, `"Unexpected message type"`, or websocket connection failures, check `gradio_client` version first.

### Reverse Engineering Steps

To replicate this from scratch against any Gradio 3.7 Space:

1. **Identify the Space URL**: `zomehwh/vits-uma-genshin-honkai`
2. **Probe with gradio_client**:
   ```python
   from gradio_client import Client
   client = Client("zomehwh/vits-uma-genshin-honkai")
   # This connects via websocket and downloads the Space's config
   ```
3. **Extract voice list from config**: The Space's `config.json` contains all dropdown options. Filter by the `日语` prefix to get JP-only voices.
4. **Identify the predict function**: Call `client.view_api()` to discover the function name and parameter signature.
5. **Call the function**:
   ```python
   result = client.predict(
       text="こんにちは",
       language="日语",
       character="日语胡桃（高桥李依）",
       noise_scale=0.6,
       noise_scale_w=0.668,
       speed=1.2,
       api_name="/predict"
   )
   # result = path to downloaded audio file
   ```
6. **Wrap in an HTTP server**: Accept OpenAI-format requests, translate to the above call, return the audio file.

### Stochastic Nature of VITS

The upstream Space documentation states: "结果具有随机性，相同参数可能产生不同语调". This is inherent to the VITS model architecture — the `noise_scale` parameters control the variance of the latent sampling. Identical inputs produce **different intonations** across calls. For best results, generate 2–3 times and select the preferred output.

## API Contract

### GET /v1/models

Returns model metadata and the full JP voice catalog.

```bash
curl -s http://<host>:<port>/v1/models
```

Response:

```json
{
  "object": "list",
  "data": [{"id": "vits-uma-jp", "object": "model", "owned_by": "community"}],
  "voices": {
    "胡桃": "日语胡桃（高桥李依）",
    "雷电将军": "日语雷电将军（泽城美雪）",
    "...": "..."
  }
}
```

Voice keys are **simplified Chinese character names**. Values include the `日语` prefix and voice actor name.

### POST /v1/audio/speech

Synthesize Japanese speech.

```bash
curl -s -X POST http://<host>:<port>/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "input": "お兄ちゃん、ただいま！",
    "voice": "胡桃",
    "speed": 1.0,
    "noise_scale": 0.5
  }' \
  -o output.wav
```

#### Parameters

| Parameter | Required | Type | Description | Range | Default |
|-----------|----------|------|-------------|-------|---------|
| `input` | Yes | string | Japanese text to synthesize | — | — |
| `voice` | Yes | string | Character name (simplified Chinese key) | See voice table | — |
| `speed` | No | float | Speech rate multiplier | 0.1–2.0 | 1.2 |
| `noise_scale` | No | float | Emotion/expressiveness variance | 0.1–1.0 | 0.6 |
| `noise_scale_w` | No | float | Phoneme duration variance | 0.1–1.0 | 0.668 |

### GET /v1/audio/speech

Query-string variant.

```
/v1/audio/speech?input=こんにちは&voice=胡桃&speed=1.0
```

### GET /health

Returns `{"status": "ok", "voices": <count>}`. Voices count of 0 means startup initialization is still loading.

## Parameter Tuning Guide

These are VITS stochastic parameters — they control the variance of the model's latent sampling, not deterministic settings.

### For Whispered/Intimate Tone

```json
{
  "noise_scale": 0.3,
  "noise_scale_w": 0.668,
  "speed": 0.85
}
```

Low `noise_scale` constrains emotion variance → flatter, quieter intonation. Slow `speed` stretches the delivery. `noise_scale_w` at default keeps natural rhythm.

### For Dramatic/Expressive Tone

```json
{
  "noise_scale": 0.8,
  "noise_scale_w": 0.75,
  "speed": 1.1
}
```

High `noise_scale` allows wider emotion swings. Elevated `noise_scale_w` adds rhythmic variation for dramatic pauses.

### For Stable/Repeatable Output

```json
{
  "noise_scale": 0.3,
  "noise_scale_w": 0.3,
  "speed": 1.0
}
```

Minimize both noise parameters to reduce randomness. Output will still vary slightly across calls, but much less.

### Parameter Boundary Warnings

- `noise_scale > 0.9`: model produces unstable/glitchy audio — clipping, pitch jumps, robotic artifacts
- `speed < 0.5`: severely distorted, syllables may be dropped
- `speed > 1.8`: audio becomes compressed and unintelligible
- `noise_scale_w < 0.2`: monotone, robotic rhythm with no natural variation

## Voice Catalog

For the complete 65-voice table with voice actors, read **`references/voices.md`**.

For the JP→voice-key mapping (Japanese character name → simplified Chinese key), read **`references/voices.md`** (appendix).

### Popular Characters Quick Reference

| Character | Voice Key | Voice Actor | Voice Type |
|-----------|-----------|-------------|------------|
| Kamisato Ayaka | `神里绫华` | Hayami Saori | Elegant, gentle |
| Hutao | `胡桃` | Takahashi Rie | Playful, bright |
| Raiden Shogun | `雷电将军` | Sawashiro Miyuki | Noble, commanding |
| Zhongli | `钟离` | Maeno Tomoaki | Deep, composed |
| Yae Miko | `八重神子` | Sakura Ayane | Sly, teasing |
| Nahida | `纳西妲` | Tamura Yukari | Childlike, wise |
| Shenhe | `申鹤` | Kawasumi Ayako | Aloof, restrained |
| Lumine | `荧` | Yuuki Aoi | Determined, bright |

## Wrapper Implementation

The wrapper source is in **`scripts/`**:

- `scripts/app.py` — aiohttp server with gradio_client 0.x integration
- `scripts/Dockerfile` — container build recipe

### Key Design Decisions in the Wrapper

1. **aiohttp over Flask/FastAPI**: the server must handle concurrent requests while the `gradio_client` websocket call is blocking. `asyncio.to_thread()` offloads each synthesis call to a thread pool.

2. **Threading Lock**: `gradio_client.Client.predict()` is not thread-safe. A `threading.Lock` serializes all calls through the same client instance. This limits throughput to ~1 request at a time (matching the free-tier Space's queue anyway).

3. **Client TTL**: the `gradio_client` connection is recreated every 5 minutes to avoid stale websocket sessions that accumulate on long-running containers.

4. **Voice init on startup**: the server queries the Space's config at boot to build the voice catalog. If the Space is sleeping, this takes 30–60s — the `/health` endpoint returns `voices: 0` until initialization completes.

### Building from Scratch

```bash
# Using the skill's scripts/
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
| `LANGUAGE` | `日语` | Language filter prefix for voice catalog |
| `BASE_URL` | `zomehwh/vits-uma-genshin-honkai` | HuggingFace Space identifier |

## Error Matrix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `health` returns `voices: 0` | Startup voice init still loading | Wait 10–15s and retry |
| HTTP 500 | Space sleeping or queue full | Wait 30–60s for Space to wake |
| `Unknown voice` | Voice key mismatch | Query `/v1/models` for exact keys; keys are simplified Chinese |
| `TypeError: object NoneType can't be used in 'await'` | aiohttp on_startup incompatibility with Python 3.13 | Ensure startup callbacks are async functions returning None |
| Port conflict | Another service on same port | Change `HTTP_PORT` |
| gradio_client connection errors | Wrong gradio_client version | Must use `<1` (0.x); 2.x is incompatible with Gradio 3.7 |

## NEVER

- **NEVER** use `gradio_client>=1` — Gradio 3.7 websocket protocol is incompatible with 2.x
- **NEVER** co-locate with qwen-tts2api on the same Docker network namespace — conflicting gradio_client versions
- **NEVER** send non-Japanese text — VITS-UMA is Japanese-only; other languages produce garbled output
- **NEVER** set `noise_scale > 0.9` — produces unstable/glitchy audio
- **NEVER** assume deterministic output — VITS is stochastic; same parameters yield different intonation
- **NEVER** hardcode voice keys from memory — verify against `/v1/models` as upstream updates may rename voices
- **NEVER** rely on real-time streaming — websocket round-trip adds 1–3s latency per request
- **NEVER** expect the wrapper to handle concurrent synthesis — the internal Lock serializes all calls
