---
name: qwen-tts2api
description: Reverse-engineered API reference for Qwen3-TTS (Alibaba's multilingual TTS) served via the aahl/qwen-tts2api OpenAI-compatible wrapper. Use when the user mentions Qwen TTS, Qwen3 TTS, Chinese TTS, multilingual TTS, voice synthesis, text-to-speech, TTS voice catalog, or needs to generate speech in Chinese (Mandarin + dialects), Japanese, Korean, English, Spanish, French, German, Russian, Italian, or Portuguese. Also use when debugging Qwen3-TTS upstream issues, HF Space migration, or integrating a self-hosted Qwen TTS endpoint.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# qwen-tts2api

OpenAI-compatible TTS API reverse-engineered from **Qwen3-TTS** (Alibaba's multilingual speech model) via the community wrapper `ghcr.io/aahl/qwen-tts2api`.

## What This Skill Covers

The Qwen3-TTS model lives behind a HuggingFace Space with no public REST endpoint. The `aahl/qwen-tts2api` container reverse-engineers the Space's Gradio websocket interface and exposes it as a standard `/v1/audio/speech` REST API — identical to OpenAI's TTS endpoint, so any OpenAI SDK works without modification.

This skill documents:
- The resulting API contract (endpoints, parameters, response format)
- The upstream architecture and how it was reverse-engineered
- The 49-voice catalog with language/dialect/character classification
- Failure modes inherent to the upstream (Space sleeping, URL migration, queue limits)
- Parameter tuning for specific speech effects

## Upstream Reverse Engineering

### Source

The Qwen3-TTS model is hosted at a HuggingFace Space:

| Endpoint | Status | Notes |
|----------|--------|-------|
| `https://qwen-qwen3-tts-demo.hf.space` | Active | Current working URL |
| `https://qwen-qwen3-tts-demo.ms.show` | **DEAD** | ModelScope migrated to SDK-only; HTTP API calls return 403 |

The Space runs Gradio with a websocket-based API. The wrapper uses `gradio_client` 2.x to connect via websocket, call the model's inference function, download the resulting audio file, and serve it as a WAV response.

### How the Wrapper Works

```
Client ──HTTP──→ qwen-tts2api ──websocket──→ HF Space (Qwen3-TTS)
                                       │
                                  gradio_client 2.x
                                  calls predict() with:
                                    - text (input)
                                    - voice_id (from /v1/models cache)
                                  downloads output audio file
                                  returns audio/wav
```

The wrapper caches the voice catalog on startup by querying the Space's config. It translates OpenAI-format requests into Gradio websocket calls internally.

### Critical Upstream Behaviors

1. **Space cold start**: Free-tier HF Spaces sleep after ~48h of inactivity. First request after wake takes 30–60s while the model loads into GPU. Subsequent requests are fast (~2–5s).

2. **URL migration**: The original ModelScope endpoint (`*.ms.show`) has been **permanently retired** for HTTP access. It now requires an SDK token. Always use the HF Space URL.

3. **Queue limits**: Free-tier Spaces have a request queue. Under load, requests may time out or return empty responses. No rate limit documentation exists; empirical limit is ~3 concurrent requests.

4. **Text length**: Qwen3-TTS produces best results under ~100 characters. Beyond ~200 characters, output quality degrades (truncation, garbling, or empty audio).

## API Contract

### Base URL

```
http://<host>:<port>
```

The container listens on the port specified by the `PORT` environment variable (default `80`).

### GET /v1/models

Returns model metadata and the full voice catalog.

```bash
curl -s http://<host>:<port>/v1/models
```

Response:

```json
{
  "object": "list",
  "data": [{"id": "qwen-tts", "object": "model", "owned_by": "community"}],
  "voices": {
    "cherry": "Cherry / 芊悦",
    "serena": "Serena / 苏瑶",
    "...": "..."
  }
}
```

The `voices` object maps **voice ID** to **display name**. Voice ID is what you pass in API calls.

### POST /v1/audio/speech

Synthesize speech. OpenAI-compatible.

```bash
curl -s -X POST http://<host>:<port>/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"voice": "vivian", "input": "你好世界"}' \
  -o output.wav
```

#### Parameters

| Parameter | Required | Type | Description | Default |
|-----------|----------|------|-------------|---------|
| `voice` | Yes | string | Voice ID from `/v1/models` | — |
| `input` | Yes | string | Text to synthesize (≤100 chars recommended) | — |
| `model` | No | string | Ignored; always `qwen-tts` | `qwen-tts` |

Unlike OpenAI's TTS API, there is **no `response_format`**, **no `speed`**, and **no `stream`** parameter. The response is always a complete WAV file (`audio/wav`).

### GET /v1/audio/speech

Query-string variant of POST.

```
/v1/audio/speech?voice=vivian&input=你好
```

### GET /health

Returns `{"status": "ok"}` if the upstream Space is reachable. Use this to detect Space sleeping before attempting synthesis.

## Voice Catalog

For the complete voice table with language tags, character descriptions, and selection tips, read **`references/voices.md`**.

### Voice Categories (49 total)

| Category | Voice IDs |
|----------|-----------|
| Mandarin female | cherry, serena, chelsie, momo, vivian, moon, maia, bella, jennifer, katerina, nini, stella |
| Mandarin male | ethan, kai, ryan, aiden, vincent, neil, elias, arthur, pip |
| Chinese dialects | li (Nanjing), marcus (Shaanxi), roy (Minnan), peter (Tianjin), eric (Sichuan), rocky (Cantonese M), kiki (Cantonese F), sunny (Sichuan F), jada (Shanghai), dylan (Beijing) |
| Japanese | ono anna |
| Korean | sohee |
| English | nofish |
| Spanish | bodega, sonrisa (Latin Am.) |
| Russian | alek |
| Italian | dolce |
| German | lenn |
| French | emilien |
| Portuguese | andre (EU), radio gol (BR) |
| Premium | eldric sage, mia, mochi, bellona, bunny, ebona, seren |

### Voice Selection Decision Tree

```
Need Chinese speech?
  ├─ Dialect/regional? → dialect voices (li, marcus, eric, kiki...)
  ├─ Standard Mandarin?
  │   ├─ Female → cherry (sweet), serena (warm), chelsie (cool), vivian (mature)
  │   └─ Male → ethan (steady), kai (bright), arthur (deep)
  └─ Generic → momo, stella
Need non-Chinese?
  ├─ Japanese → ono anna
  ├─ Korean → sohee
  ├─ European → see category table
  └─ Premium/distinguished → eldric sage, bellona, seren
```

## Deployment from Scratch

If the container is not already running, deploy it with:

```bash
docker pull ghcr.io/aahl/qwen-tts2api:main
docker run -d --name qwen-tts2api \
  --restart=unless-stopped \
  -e BASE_URL="https://qwen-qwen3-tts-demo.hf.space" \
  -e PORT=80 \
  ghcr.io/aahl/qwen-tts2api:main
```

Network options:
- **Direct egress**: default Docker networking
- **VPN isolation**: `--network=container:<vpn-container-name>` — all outbound traffic routes through the VPN container's network namespace. Port conflicts may arise if the VPN namespace already has a service on port 80; change `PORT` to resolve.

The container requires `gradio_client>=2` (bundled in the image). It is incompatible with containers that need `gradio_client<1` — run them on separate network namespaces.

## Error Matrix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| HTTP 500 + "Could not fetch config" | Upstream Space URL wrong or Space sleeping | Verify `BASE_URL`, wait 30–60s for Space to wake |
| HTTP 403 from `*.ms.show` | ModelScope endpoint retired for API use | Change `BASE_URL` to `https://qwen-qwen3-tts-demo.hf.space`, restart container |
| 0-byte / empty audio | Space queue full or model still loading | Retry after 30s; free-tier Spaces have limited capacity |
| Port bind failure | Another service on same network namespace uses that port | Change `PORT` env var |

## NEVER

- **NEVER** use `*.ms.show` as BASE_URL — permanently retired, returns 403 for HTTP
- **NEVER** send text >200 chars — Qwen3-TTS truncates or garbles beyond ~100 chars
- **NEVER** assume the Space is always warm — first request after sleep takes 30–60s
- **NEVER** co-locate with gradio_client<1 containers on the same network namespace — version conflict
- **NEVER** expect `speed`, `stream`, or `response_format` parameters — this wrapper does not implement them
