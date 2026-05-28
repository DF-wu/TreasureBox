---
name: vits-hf2api
description: Self-hosted OpenAI-compatible TTS API wrapper for VITS UMA Genshin Honkai (500+ anime/game character voices) HuggingFace Space. Use when the user mentions VITS TTS, anime voice synthesis, game character TTS, Genshin Impact voice, Honkai voice, Uma Musume voice, Japanese/Chinese character text-to-speech, voice cloning for anime characters, or building self-hosted VITS endpoints. Also use when debugging VITS upstream issues, deploying Gradio 3.x websocket wrappers, tuning noise_scale/length_scale parameters, or integrating anime/game voice APIs. Covers speaker catalog, parameter tuning guide, Docker VPN deployment, and the complete reverse-engineered Gradio 3.x websocket protocol.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# vits-hf2api

OpenAI-compatible TTS API wrapper for VITS UMA Genshin Honkai HuggingFace Space. Supports 500+ anime/game character voices (approximate mapping; speaker IDs may not exactly match the live Space).

## Architecture

```
Client ──HTTP──→ vits-hf2api ──websocket──→ HF Space (VITS UMA Genshin Honkai)
                                    │
                              Gradio 3.x protocol (custom client)
                              Docker network_mode: service:gluetun
```

The wrapper uses a custom WebSocket client for Gradio 3.x protocol (no gradio_client dependency) and routes all outbound traffic through the gluetun VPN container.

## Endpoints

### `GET /v1/models`

List available speakers and languages.

**Query Parameters:**
- `search` (optional): Filter speakers by name substring (case-insensitive, supports CJK)

**Response:**
```json
{
  "data": [{"id": "vits-uma-genshin-honkai"}],
  "speakers": [
    {"id": 0, "name": "派蒙"},
    {"id": 23, "name": "钟离"},
    ...
  ],
  "languages": {"zh": "中文", "ja": "日本語", "mix": "Mix"}
}
```

### `POST /v1/audio/speech`

Text-to-Speech synthesis with anime/game character voices.

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>` (optional)

**Body:**
```json
{
  "model": "vits-uma-genshin-honkai",
  "input": "你好！",
  "voice": "派蒙",
  "language": "zh",
  "response_format": "wav",
  "noise_scale": 0.6,
  "noise_scale_w": 0.668,
  "length_scale": 1.2
}
```

**Parameters:**
| Field | Type | Required | Default | Range | Description |
|-------|------|----------|---------|-------|-------------|
| `model` | string | No | — | — | Ignored |
| `input` | string | Yes | — | Max 100 chars | Text to synthesize |
| `voice` | string | No | `派蒙` | — | Speaker name or alias |
| `language` | string | No | `mix` | `zh`/`ja`/`mix` | Language |
| `response_format` | string | No | `wav` | — | Only `wav` supported |
| `speed` | float | No | — | >0 | Inverse of `length_scale` |
| `noise_scale` | float | No | `0.6` | 0.1–1.0 | Emotional variation |
| `noise_scale_w` | float | No | `0.668` | 0.1–1.0 | Phoneme length variation |
| `length_scale` | float | No | `1.2` | 0.1–2.0 | Overall speed (overridden by `speed`) |

**Response:** `audio/wav` binary stream.

**Note:** Text longer than 100 characters is truncated with `X-Warning: text-truncated`.

**Speaker Aliases (examples):**
- `paimon` → `派蒙`
- `zhongli` → `钟离`
- `raiden` → `雷电将军`
- `ayaka` → `神里绫华`
- `kafka` → `卡芙卡`
- `march7th` → `三月七`

## Parameter Tuning Guide

### For Whispered/Intimate Tone
```json
{"noise_scale": 0.3, "noise_scale_w": 0.668, "length_scale": 1.4}
```
Low `noise_scale` constrains emotion → flatter, quieter intonation. Higher `length_scale` → slower delivery.

### For Dramatic/Expressive Tone
```json
{"noise_scale": 0.8, "noise_scale_w": 0.75, "length_scale": 1.1}
```
High `noise_scale` allows wider emotion swings.

### For Fast/Casual Tone
```json
{"noise_scale": 0.5, "noise_scale_w": 0.668, "length_scale": 0.9}
```
Lower `length_scale` → shorter phoneme duration → faster speech.

### Boundary Warnings
- `noise_scale > 0.9`: unstable/glitchy audio
- `length_scale < 0.5`: severely distorted, syllables dropped
- `length_scale > 1.8`: extremely slow, may sound unnatural
- `noise_scale_w < 0.2`: monotone, robotic rhythm

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://zomehwh-vits-uma-genshin-honkai.hf.space` | VITS Space URL |
| `HOST` | `0.0.0.0` | Listen host |
| `PORT` | `80` | Listen port |
| `API_KEY` | *(none)* | Optional Bearer token |
| `DEFAULT_SPEAKER` | `派蒙` | Default voice |
| `DEFAULT_LANGUAGE` | `mix` | Default language |
| `DEFAULT_NOISE_SCALE` | `0.6` | Default noise scale |
| `DEFAULT_NOISE_SCALE_W` | `0.668` | Default noise scale W |
| `DEFAULT_LENGTH_SCALE` | `1.2` | Default length/speed |
| `FN_INDEX` | `0` | Gradio function index |
| `REQUEST_TIMEOUT` | `120` | Upstream timeout (seconds) |

## Deployment

```bash
docker compose up -d
```

All outbound traffic routes through the `gluetun` VPN container.

## Docker Compose Snippet

```yaml
services:
  vits-hf2api:
    build: ./vits-hf2api
    network_mode: "service:gluetun"
    environment:
      PORT: "8830"
      API_KEY: ${API_KEY:-}
    depends_on:
      gluetun:
        condition: service_healthy
```

## Speaker Catalog

For the complete speaker table (500+ voices), read **`references/speakers.json`**.

## NEVER

- **NEVER** send text >100 chars to HF-hosted Space — hard limit returns error instead of audio
- **NEVER** set `noise_scale > 0.9` — produces unstable/glitchy audio
- **NEVER** assume deterministic output — VITS is stochastic; same parameters yield different intonation
- **NEVER** ignore punctuation — it directly affects the model's intonation output
- **NEVER** hardcode voice indices from memory — verify against `/v1/models` as upstream may update
