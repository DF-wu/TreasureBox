---
name: qwen3-hf2api
description: Self-hosted OpenAI-compatible API wrapper for Qwen3 TTS (48 voices, 12 languages) and ASR (32 languages) HuggingFace Spaces. Use when the user mentions Qwen3 TTS, Qwen3 ASR, text-to-speech, speech-to-text, voice synthesis, multilingual TTS, Chinese/Japanese/Korean/English/German/French/Russian/Portuguese/Spanish/Italian TTS, automatic speech recognition, audio transcription, or self-hosted audio API with VPN routing. Also use when debugging Qwen3 upstream issues, deploying HF Space wrappers, integrating voice endpoints, or building Dockerized audio services. Covers voice catalog, language selection, parameter tuning, TTS and ASR endpoints, and Docker deployment with gluetun VPN.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# qwen3-hf2api

OpenAI-compatible audio API wrapper for Qwen3 TTS and ASR HuggingFace Spaces, self-hosted via Docker with all outbound traffic routed through a gluetun VPN container.

## Architecture

```
Client ──HTTP──→ qwen3-hf2api ──SSE/websocket──→ HF Space (Qwen3-TTS or Qwen3-ASR)
                                    │
                              Docker network_mode: service:gluetun
```

The wrapper runs an aiohttp server that translates OpenAI-compatible requests into Gradio SSE v3 calls for TTS and multipart form uploads for ASR.

## Endpoints

### `GET /v1/models`

List available models, voices, and languages.

**Response:**
```json
{
  "data": [
    {"id": "qwen-tts", "type": "tts"},
    {"id": "qwen3-asr", "type": "asr"},
    {"id": "qwen3-asr:itn", "type": "asr"}
  ],
  "voices": { "vivian": "Vivian / 十三", ... },
  "languages": { "zh": "Chinese / 中文", ... }
}
```

### `POST /v1/audio/speech`

Text-to-Speech synthesis.

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>` (optional, only if `API_KEY` env var is set)

**Body:**
```json
{
  "model": "qwen-tts",
  "input": "Hello, world!",
  "voice": "vivian",
  "language": "auto",
  "response_format": "wav"
}
```

**Parameters:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `model` | string | No | `qwen-tts` | Ignored (Space uses its own) |
| `input` | string | Yes | — | Text to synthesize |
| `voice` | string | No | `vivian` | Voice ID or alias (48 voices) |
| `language` | string | No | `auto` | Language code (12 options) |
| `response_format` | string | No | `wav` | Only `wav` supported |
| `speed` | float | No | — | Not supported (returns `X-Warning`) |

**Response:** `audio/wav` binary stream.

**Voice Aliases:**
- `alloy` → `vivian`
- `echo` → `ethan`
- `fable` → `adam`
- `onyx` → `jack`
- `nova` → `chelsea`
- `shimmer` → `diana`

### `POST /v1/audio/transcriptions`

Automatic Speech Recognition (ASR).

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <API_KEY>` (optional)

**Form Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | Yes | — | Audio file (WAV, MP3, etc.) |
| `model` | string | No | `qwen3-asr` | Use `qwen3-asr:itn` for inverse text normalization |
| `language` | string | No | `auto` | Language hint (32 options) |
| `prompt` | string | No | — | Optional prompt for ASR |

**Response:**
```json
{
  "text": "Transcribed text here"
}
```

**Note:** If the upstream ASR Space returns `error:null`, the endpoint returns HTTP 503 with:
```json
{"error": "ASR upstream unavailable: Space returns error:null"}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TTS_BASE_URL` | `https://qwen-qwen3-tts-demo.hf.space` | Qwen3 TTS Space URL |
| `ASR_BASE_URL` | `https://qwen-qwen3-asr.hf.space` | Qwen3 ASR Space URL |
| `HOST` | `0.0.0.0` | Listen host |
| `PORT` | `80` | Listen port |
| `API_KEY` | *(none)* | Optional Bearer token |
| `DEFAULT_VOICE` | `vivian` | Default TTS voice |
| `DEFAULT_LANGUAGE` | `auto` | Default language |
| `REQUEST_TIMEOUT` | `300` | Upstream timeout (seconds) |

## Deployment

```bash
docker compose up -d
```

All outbound traffic routes through the `gluetun` VPN container.

## Docker Compose Snippet

```yaml
services:
  qwen3-hf2api:
    build: ./qwen3-hf2api
    network_mode: "service:gluetun"
    environment:
      PORT: "8820"
      API_KEY: ${API_KEY:-}
    depends_on:
      gluetun:
        condition: service_healthy
```

## Voice Catalog

For the complete 48-voice table, read **`references/voices.json`**.

## Language Catalog

For TTS languages (12), read **`references/tts_languages.json`**.
For ASR languages (32), read **`references/asr_languages.json`**.
