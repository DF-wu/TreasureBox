---
name: vits-uma-jp
description: Deploy and operate an OpenAI-compatible TTS API wrapping the VITS-UMA Genshin/Honkai Japanese voice model (65 JP-dubbed character voices from Genshin Impact). Use when the user mentions Genshin TTS, Japanese anime TTS, VITS-UMA, 原神日配, Genshin Japanese voice, anime character speech, or needs to generate Japanese speech using character voices from Genshin Impact (Ayaka, Hutao, Raiden Shogun, Zhongli, Yae Miko, etc.). Also use for deploying the custom vits-uma-api wrapper container, debugging Gradio 3.7 websocket TTS, or integrating anime character voices into applications.
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"]}}}
---

# vits-uma-jp

Self-hosted OpenAI-compatible TTS API wrapping the **VITS-UMA** model from HuggingFace Space `zomehwh/vits-uma-genshin-honkai`, filtered to **65 Japanese-dubbed character voices** from Genshin Impact.

The upstream Space runs on Gradio 3.7 with `show_api: false` — there is no REST endpoint. This wrapper uses `gradio_client` 0.x via websocket to call the model, then serves the result behind a standard `/v1/audio/speech` REST interface.

## When to Use This Skill

- Deploying or redeploying the vits-uma-api container
- Generating Japanese speech in Genshin Impact character voices
- Querying the JP voice catalog (65 characters)
- Debugging Gradio 3.7 websocket TTS failures
- Choosing between this skill and qwen-tts2api (see decision tree below)

## TTS Skill Decision Tree

```
Need speech synthesis?
├─ Japanese, anime/Genshin character voice? → THIS SKILL (vits-uma-jp)
├─ Chinese or multilingual? → qwen-tts2api
├─ Need specific voice acting / character tone? → THIS SKILL
└─ Need long-form narration? → qwen-tts2api (vits-uma has ~100 char limit)
```

## Architecture

```
Client → :<PORT>/v1/audio/speech → vits-uma-api container → HF Space (Gradio 3.7 websocket)
                                        ↑
                                   gluetun VPN (optional)
```

The wrapper (`app.py`) maintains a persistent `gradio_client` connection to the HF Space, with TTL-based reconnection (5 minutes) to avoid stale websocket sessions.

## Deployment

### Build and Run

The wrapper is a custom Python application. Dockerfile and `app.py` must be built locally.

```bash
docker build -t vits-uma-api:latest <path-to-source-dir>

docker run -d \
  --name vits-uma-api \
  --network=container:<vpn-container-name> \  # optional, for VPN egress
  --restart=unless-stopped \
  -e HTTP_PORT=8080 \
  -e LANGUAGE=日语 \
  vits-uma-api:latest
```

### Container Source Structure

```
vits-uma-api/
├── Dockerfile
└── app.py          # aiohttp server + gradio_client 0.x wrapper
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `HTTP_PORT` | No | Listen port | `80` |
| `LANGUAGE` | No | Language filter prefix sent to upstream | `日语` |
| `BASE_URL` | No | HuggingFace Space identifier | `zomehwh/vits-uma-genshin-honkai` |

### Critical: gradio_client Version Incompatibility

This container **MUST** use `gradio_client<1` (0.x series). The upstream Space runs Gradio 3.7, which uses a websocket protocol incompatible with `gradio_client` 2.x. If you see errors like `"No api_name found"` or connection failures, check the installed `gradio_client` version.

**Do NOT** run this container on the same Docker network namespace as `qwen-tts2api` — they require incompatible `gradio_client` versions. Use separate network namespaces or assign different ports.

### Port Conflicts

When sharing a network namespace with another container (e.g., via `--network=container:gluetun`), only one process can bind each port. If port 80 is already taken, use `HTTP_PORT=8080` or any available port.

## API Reference

### GET /v1/models

Returns model metadata and the full JP voice catalog.

```bash
curl -s http://<host>:<port>/v1/models
```

Response structure:

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

Voice keys are **simplified Chinese character names** (e.g., `胡桃`, `神里绫华`, `雷电将军`). The value is the full display name including the `日语` prefix and voice actor name in parentheses.

### POST /v1/audio/speech

Synthesize Japanese speech in a character's voice.

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
| `voice` | Yes | string | Character name (simplified Chinese) | See voice table | — |
| `speed` | No | float | Speech rate. <1.0 = slower, >1.0 = faster | 0.1–2.0 | 1.2 |
| `noise_scale` | No | float | Emotion variation. Higher = more expressive (but may be unstable) | 0.1–1.0 | 0.6 |
| `noise_scale_w` | No | float | Phoneme duration variance. Higher = more natural rhythm variation | 0.1–1.0 | 0.668 |

#### Parameter Tuning Guide

These are VITS model parameters. They control the stochastic elements of the synthesis, not deterministic settings.

**For whispered/intimate tone**:
- `noise_scale`: 0.3–0.5 (reduce emotion swing)
- `speed`: 0.8–0.9 (slower delivery)
- `noise_scale_w`: 0.668 (default is fine)

**For dramatic/expressive tone**:
- `noise_scale`: 0.7–0.9 (wider emotion range)
- `speed`: 1.0–1.2 (natural to slightly fast)
- `noise_scale_w`: 0.7–0.8 (more rhythmic variation)

**For stable/consistent output** (minimize randomness):
- `noise_scale`: 0.3 (near-deterministic)
- `noise_scale_w`: 0.3 (uniform phoneme length)
- `speed`: 1.0

**Important**: The upstream Space documentation states that results have inherent randomness — identical parameters may produce different intonations across calls. For best results, generate 2–3 times and select the preferred output.

### GET /v1/audio/speech

Same as POST but parameters are query strings.

```
/v1/audio/speech?input=こんにちは&voice=胡桃&speed=1.0
```

### GET /health

Returns `{"status": "ok", "voices": <count>}`. A `voices` count of 0 means the startup voice initialization has not completed yet.

## Voice Catalog

For the complete voice table with voice actor names and notes, read **`references/voices.md`**.

### Quick Reference: Popular Characters

| Character | Voice Key | Voice Actor | Voice Type |
|-----------|-----------|-------------|------------|
| Kamisato Ayaka | `神里绫华` | Hayami Saori | Elegant, gentle |
| Hutao | `胡桃` | Takahashi Rie | Playful, bright |
| Raiden Shogun | `雷电将军` | Sawashiro Miyuki | Noble, commanding |
| Zhongli | `钟离` | Maeno Tomoaki | Deep, composed |
| Yae Miko | `八重神子` | Sakura Ayane | Sly, teasing |
| Ganyu | `甘雨` | Ueda Reina | Soft, earnest |
| Kaedehara Kazuha | `万叶` | Shimazaki Nobunaga | Calm, poetic |
| Yoimiya | `宵宫` | Ueda Kana | Cheerful, energetic |
| Sangonomiya Kokomi | `心海` | Mimori Suzuko | Serene, strategic |
| Kamisato Ayato | `神里绫人` | Ishida Akira | Refined, calculating |
| Nahida | `纳西妲` | Tamura Yukari | Childlike, wise |
| Shenhe | `申鹤` | Kawasumi Ayako | Aloof, restrained |
| Ei/Beelzebul | (use `雷电将军`) | — | — |
| Lumine | `荧` | Yuuki Aoi | Determined, bright |
| Aether | `空` | Horie Shun | Steady, warm |

### Voice Key Convention

Voice keys use **simplified Chinese** character names as they appear in the upstream model config. Some common mappings:

| Japanese Name | Voice Key |
|---------------|-----------|
| フータオ | `胡桃` |
| 雷電将軍 | `雷电将军` |
| 神里綾華 | `神里绫华` |
| 鍾離 | `钟离` |
| 八重神子 | `八重神子` |

If a voice key is not found, the API attempts partial matching against the full display name. If all else fails, check `/v1/models` for the exact key.

## Error Handling

| Symptom | Cause | Fix |
|---------|-------|-----|
| `health` returns `voices: 0` | Startup voice init still loading from HF | Wait 10–15 seconds and retry |
| HTTP 500 | Upstream Space sleeping or queue full | Wait 30–60s for Space to wake; free-tier Spaces have limited capacity |
| `Unknown voice` | Voice key mismatch | Query `/v1/models` for exact keys; remember keys are simplified Chinese |
| `TypeError: object NoneType can't be used in 'await'` | aiohttp startup hook incompatibility with Python 3.13 | Ensure `app.on_startup` callbacks are async functions returning None |
| Port conflict | Another container on same network namespace uses that port | Change `HTTP_PORT` and restart |
| `gradio_client` connection errors | Wrong `gradio_client` version | Must use `gradio_client<1` (0.x); 2.x is incompatible with Gradio 3.7 |

## NEVER

- **NEVER** use `gradio_client>=1` with this container — Gradio 3.7 websocket protocol is incompatible
- **NEVER** co-locate this container with `qwen-tts2api` on the same Docker network namespace — they require conflicting `gradio_client` versions
- **NEVER** send non-Japanese text to this API — the VITS-UMA model is Japanese-only; Chinese/English input will produce garbled output
- **NEVER** set `noise_scale` above 0.9 — the model produces unstable/glitchy audio beyond this threshold
- **NEVER** assume deterministic output — VITS is a stochastic model; same input may yield different intonation across calls
- **NEVER** rely on this for real-time streaming — the websocket round-trip adds 1–3s latency per request
- **NEVER** hardcode the voice key from memory — always verify against `/v1/models` if unsure, as upstream model updates may add or rename voices
