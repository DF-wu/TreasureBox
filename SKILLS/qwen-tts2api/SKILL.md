---
name: qwen-tts2api
description: Deploy and operate an OpenAI-compatible TTS API backed by Qwen3-TTS via the aahl/qwen-tts2api Docker container. Use when the user mentions Qwen TTS, Qwen3 TTS, Chinese TTS, multilingual TTS, TTS deployment, voice synthesis, text-to-speech API, or needs to generate speech in Chinese (Mandarin + dialects), Japanese, Korean, English, Spanish, French, German, Russian, Italian, or Portuguese. Also use when the user asks about TTS voice catalogs, TTS container setup, or integrating a self-hosted speech API.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# qwen-tts2api

Self-hosted OpenAI-compatible TTS API powered by **Qwen3-TTS** (Alibaba's multilingual speech model), wrapped in the community container `ghcr.io/aahl/qwen-tts2api`.

The container proxies a HuggingFace Space running Qwen3-TTS, exposing it behind a standard `/v1/audio/speech` endpoint so any OpenAI SDK or curl call works without modification.

## When to Use This Skill

- Deploying or redeploying the Qwen3-TTS container
- Querying available voices or generating speech in any supported language
- Debugging TTS failures (upstream space sleeping, URL migration, port conflicts)
- Integrating a self-hosted TTS endpoint into an application

## Architecture

```
Client → :<PORT>/v1/audio/speech → qwen-tts2api container → HuggingFace Space (Qwen3-TTS)
                                        ↑
                                   gluetun VPN (optional)
```

The container uses `gradio_client` 2.x to call the upstream HF Space via websocket. All network egress can be routed through a VPN container (`--network=container:<vpn>`) to isolate traffic.

## Deployment

### Pull and Run

```bash
docker pull ghcr.io/aahl/qwen-tts2api:main

docker run -d \
  --name qwen-tts2api \
  --network=container:<vpn-container-name> \  # optional, for VPN egress
  --restart=unless-stopped \
  -e BASE_URL="https://qwen-qwen3-tts-demo.hf.space" \
  -e PORT=80 \
  ghcr.io/aahl/qwen-tts2api:main
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `BASE_URL` | Yes | HuggingFace Space URL for Qwen3-TTS | — |
| `PORT` | No | Container listen port | `80` |

### Critical: BASE_URL Migration

The original ModelScope endpoint (`https://qwen-qwen3-tts-demo.ms.show`) has been **permanently migrated** to a ModelScope SDK-only endpoint that rejects HTTP API calls with 403. You **MUST** use the HuggingFace Space URL instead:

```
BASE_URL=https://qwen-qwen3-tts-demo.hf.space
```

If you encounter 403 from a `ms.show` domain, change `BASE_URL` and restart the container immediately.

## API Reference

### GET /v1/models

Returns model metadata and the full voice catalog.

```bash
curl -s http://<host>:<port>/v1/models
```

Response structure:

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

The `voices` object maps **voice ID** (use in API calls) to **display name** (character name + Chinese name).

### POST /v1/audio/speech

Synthesize speech. OpenAI-compatible format.

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
| `input` | Yes | string | Text to synthesize (≤~100 chars recommended) | — |
| `model` | No | string | Model identifier | `qwen-tts` |

The response body is raw PCM/WAV audio (`audio/wav`).

### GET /v1/audio/speech

Same as POST, but parameters are passed as query string. Useful for quick browser tests.

```
/v1/audio/speech?voice=vivian&input=你好
```

### GET /health

Health check. Returns `{"status": "ok"}` if the upstream Space is reachable.

## Voice Catalog (49 voices)

For the complete voice table with language tags and descriptions, read **`references/voices.md`**.

### Quick Reference by Category

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
| Premium collection | eldric sage, mia, mochi, bellona, bunny, ebona, seren |

### Voice Selection Decision Tree

```
Need Chinese speech?
  ├─ Dialect/regional flavor? → dialect voices (li, marcus, eric, kiki, etc.)
  ├─ Standard Mandarin?
  │   ├─ Female → cherry (sweet), serena (warm), chelsie (cool), vivian (mature)
  │   └─ Male → ethan (steady), kai (bright), arthur (deep)
  └─ Generic/neutral → momo, stella
Need non-Chinese?
  ├─ Japanese → ono anna
  ├─ Korean → sohee
  ├─ European language → see category table above
  └─ Premium/distinguished → eldric sage, bellona, seren
```

## Error Handling

| Symptom | Cause | Fix |
|---------|-------|-----|
| HTTP 500 + "Could not fetch config" | Upstream Space URL wrong or Space is sleeping | Verify `BASE_URL`, wait for Space to wake (may take 30–60s), or switch to HF Space URL |
| HTTP 403 from `*.ms.show` | ModelScope endpoint migrated to SDK-only | Change `BASE_URL` to `https://qwen-qwen3-tts-demo.hf.space` and restart |
| Empty response / 0-byte audio | Space queue full or model loading | Retry after 30s; the free-tier Space has limited capacity |
| Port 80 already in use | Another container on the same network namespace uses 80 | Change `PORT` env var and restart |
| "gradio_client" version conflict | Another container on same host needs gradio_client 0.x | This container uses gradio_client 2.x; run in separate network namespace or host |

## NEVER

- **NEVER** use the `ms.show` BASE_URL — it has been permanently retired for API access
- **NEVER** assume the Space is always warm — free-tier HF Spaces sleep after inactivity; first request may take 30–60s
- **NEVER** send text >200 characters — Qwen3-TTS truncates or produces garbled output beyond ~100 chars
- **NEVER** mix this container's `gradio_client` 2.x dependency with containers requiring `gradio_client` 0.x on the same network namespace — they are incompatible
- **NEVER** expose this service publicly without authentication — it has no built-in auth
